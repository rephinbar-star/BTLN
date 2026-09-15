CREATE TABLE public.analysis_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  snapshot_json jsonb NOT NULL,
  include_names boolean NOT NULL DEFAULT false,
  include_quotes boolean NOT NULL DEFAULT false,
  visit_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.analysis_share_links TO service_role;
ALTER TABLE public.analysis_share_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX analysis_share_links_analysis_idx ON public.analysis_share_links(analysis_id);

CREATE TRIGGER update_analysis_share_links_updated_at
BEFORE UPDATE ON public.analysis_share_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.analysis_recipient_perspectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_link_id uuid NOT NULL REFERENCES public.analysis_share_links(id) ON DELETE CASCADE,
  participant_index integer NOT NULL,
  participant_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, share_link_id, participant_index)
);

GRANT SELECT ON public.analysis_recipient_perspectives TO authenticated;
GRANT ALL ON public.analysis_recipient_perspectives TO service_role;
ALTER TABLE public.analysis_recipient_perspectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own perspectives readable"
ON public.analysis_recipient_perspectives
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_analysis_recipient_perspectives_updated_at
BEFORE UPDATE ON public.analysis_recipient_perspectives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.resolve_analysis_share(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_snapshot jsonb;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) < 32 THEN
    RETURN NULL;
  END IF;

  SELECT s.id, s.snapshot_json INTO v_id, v_snapshot
    FROM public.analysis_share_links s
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.analysis_share_links SET visit_count = visit_count + 1 WHERE id = v_id;

  RETURN v_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_analysis_share_for_owner(p_analysis_id uuid, p_session_id uuid)
RETURNS TABLE(id uuid, include_names boolean, include_quotes boolean, revoked_at timestamptz, visit_count integer, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.include_names, s.include_quotes, s.revoked_at, s.visit_count, s.created_at
    FROM public.analysis_share_links s
    JOIN public.analyses a ON a.id = s.analysis_id
   WHERE s.analysis_id = p_analysis_id
     AND s.revoked_at IS NULL
     AND (
       (auth.uid() IS NOT NULL AND a.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND a.session_id = p_session_id AND a.user_id IS NULL)
     )
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.save_analysis_recipient_perspective(p_token_hash text, p_participant_index integer, p_participant_label text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_share uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;
  IF p_token_hash IS NULL OR length(p_token_hash) < 32 THEN
    RAISE EXCEPTION 'invalid link';
  END IF;
  IF p_participant_index IS NULL OR p_participant_index < 0 OR p_participant_index > 1 THEN
    RAISE EXCEPTION 'invalid participant';
  END IF;

  SELECT s.id INTO v_share
    FROM public.analysis_share_links s
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
   LIMIT 1;

  IF v_share IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.analysis_recipient_perspectives (user_id, share_link_id, participant_index, participant_label)
  VALUES (auth.uid(), v_share, p_participant_index, NULLIF(trim(coalesce(p_participant_label, '')), ''))
  ON CONFLICT (user_id, share_link_id, participant_index)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;