CREATE TABLE public.group_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'friends',
  participant_count integer NOT NULL DEFAULT 0,
  message_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  result_json jsonb,
  stats_json jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT group_reads_category_check CHECK (category IN ('friends','family','work')),
  CONSTRAINT group_reads_status_check CHECK (status IN ('pending','analyzing','complete','failed')),
  CONSTRAINT group_reads_participants_check CHECK (participant_count >= 0 AND participant_count <= 15)
);

GRANT SELECT ON public.group_reads TO authenticated;
GRANT ALL ON public.group_reads TO service_role;

ALTER TABLE public.group_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own group reads"
  ON public.group_reads FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE TRIGGER update_group_reads_updated_at
  BEFORE UPDATE ON public.group_reads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX group_reads_session_idx ON public.group_reads (session_id, created_at DESC);
CREATE INDEX group_reads_user_idx ON public.group_reads (user_id, created_at DESC);

CREATE TABLE public.group_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_read_id uuid NOT NULL REFERENCES public.group_reads(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  include_names boolean NOT NULL DEFAULT false,
  include_quotes boolean NOT NULL DEFAULT false,
  visit_count integer NOT NULL DEFAULT 0,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.group_share_links TO authenticated;
GRANT ALL ON public.group_share_links TO service_role;

ALTER TABLE public.group_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own group share links"
  ON public.group_share_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_reads g
    WHERE g.id = group_share_links.group_read_id
      AND g.user_id IS NOT NULL
      AND g.user_id = auth.uid()
  ));

CREATE TRIGGER update_group_share_links_updated_at
  BEFORE UPDATE ON public.group_share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX group_share_links_group_idx ON public.group_share_links (group_read_id);

CREATE OR REPLACE FUNCTION public.get_group_read_for_session(p_id uuid, p_session_id uuid)
RETURNS TABLE(
  id uuid,
  status text,
  category text,
  participant_count integer,
  message_count integer,
  result_json jsonb,
  stats_json jsonb,
  error_message text,
  user_id uuid,
  session_id uuid,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.id, g.status, g.category, g.participant_count, g.message_count,
         g.result_json, g.stats_json, g.error_message, g.user_id, g.session_id, g.created_at
    FROM public.group_reads g
   WHERE g.id = p_id
     AND (
       (auth.uid() IS NOT NULL AND g.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND g.session_id = p_session_id AND g.user_id IS NULL)
     )
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_group_share_for_owner(p_group_read_id uuid, p_session_id uuid)
RETURNS TABLE(id uuid, include_names boolean, include_quotes boolean, revoked_at timestamp with time zone, visit_count integer, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.include_names, s.include_quotes, s.revoked_at, s.visit_count, s.created_at
    FROM public.group_share_links s
    JOIN public.group_reads g ON g.id = s.group_read_id
   WHERE s.group_read_id = p_group_read_id
     AND s.revoked_at IS NULL
     AND (
       (auth.uid() IS NOT NULL AND g.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND g.session_id = p_session_id AND g.user_id IS NULL)
     )
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_group_share(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
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
    FROM public.group_share_links s
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.group_share_links
     SET visit_count = visit_count + 1
   WHERE id = v_id;

  RETURN v_snapshot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_read_for_session(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_share_for_owner(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_group_share(text) TO anon, authenticated;