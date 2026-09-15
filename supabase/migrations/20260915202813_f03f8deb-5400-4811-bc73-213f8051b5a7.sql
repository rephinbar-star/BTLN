CREATE TABLE public.roasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('analysis','group_read')),
  source_id uuid NOT NULL,
  tone text NOT NULL DEFAULT 'playful' CHECK (tone IN ('playful','gentle')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','analyzing','complete','failed','blocked')),
  result_json jsonb,
  safety_blocked boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX roasts_source_tone_key ON public.roasts (source_type, source_id, tone);
CREATE INDEX roasts_session_idx ON public.roasts (session_id);
CREATE INDEX roasts_user_idx ON public.roasts (user_id);

GRANT SELECT ON public.roasts TO authenticated;
GRANT ALL ON public.roasts TO service_role;
ALTER TABLE public.roasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their roasts"
  ON public.roasts FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE TRIGGER update_roasts_updated_at
  BEFORE UPDATE ON public.roasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.roast_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id uuid NOT NULL REFERENCES public.roasts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  snapshot_json jsonb NOT NULL,
  include_names boolean NOT NULL DEFAULT false,
  include_quotes boolean NOT NULL DEFAULT false,
  visit_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX roast_share_links_roast_idx ON public.roast_share_links (roast_id);

GRANT ALL ON public.roast_share_links TO service_role;
ALTER TABLE public.roast_share_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_roast_for_session(p_id uuid, p_session_id uuid)
RETURNS TABLE(id uuid, status text, source_type text, source_id uuid, tone text,
              result_json jsonb, safety_blocked boolean, error_message text,
              user_id uuid, session_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.status, r.source_type, r.source_id, r.tone, r.result_json,
         r.safety_blocked, r.error_message, r.user_id, r.session_id, r.created_at
    FROM public.roasts r
   WHERE r.id = p_id
     AND (
       (auth.uid() IS NOT NULL AND r.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND r.session_id = p_session_id AND r.user_id IS NULL)
     )
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_roast_for_source(p_source_type text, p_source_id uuid, p_session_id uuid)
RETURNS TABLE(id uuid, status text, tone text, safety_blocked boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.status, r.tone, r.safety_blocked, r.created_at
    FROM public.roasts r
   WHERE r.source_type = p_source_type
     AND r.source_id = p_source_id
     AND (
       (auth.uid() IS NOT NULL AND r.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND r.session_id = p_session_id AND r.user_id IS NULL)
     )
   ORDER BY r.created_at DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_roast_share_for_owner(p_roast_id uuid, p_session_id uuid)
RETURNS TABLE(id uuid, include_names boolean, include_quotes boolean, revoked_at timestamptz,
              visit_count integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.id, s.include_names, s.include_quotes, s.revoked_at, s.visit_count, s.created_at
    FROM public.roast_share_links s
    JOIN public.roasts r ON r.id = s.roast_id
   WHERE s.roast_id = p_roast_id
     AND s.revoked_at IS NULL
     AND (
       (auth.uid() IS NOT NULL AND r.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND r.session_id = p_session_id AND r.user_id IS NULL)
     )
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_roast_share(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_snapshot jsonb;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) < 32 THEN
    RETURN NULL;
  END IF;

  SELECT s.id, s.snapshot_json INTO v_id, v_snapshot
    FROM public.roast_share_links s
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.roast_share_links SET visit_count = visit_count + 1 WHERE id = v_id;

  RETURN v_snapshot;
END;
$$;