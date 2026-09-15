CREATE OR REPLACE FUNCTION public.count_group_reads_since_cutoff(p_session_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*), 0)::integer
    FROM public.group_reads g
   WHERE g.created_at >= timestamptz '2026-09-15 22:00:00+00'
     AND g.status <> 'failed'
     AND (
       (auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() = p_user_id AND g.user_id = p_user_id)
       OR (p_session_id IS NOT NULL AND g.session_id = p_session_id)
     );
$$;