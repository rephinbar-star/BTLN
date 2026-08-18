CREATE OR REPLACE FUNCTION public.count_completed_decodes(p_session_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*), 0)::integer
    FROM public.decodes d
   WHERE d.status = 'complete'
     AND (
       (p_session_id IS NOT NULL AND d.session_id = p_session_id)
       OR (auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() = p_user_id AND d.user_id = p_user_id)
     );
$$;

GRANT EXECUTE ON FUNCTION public.count_completed_decodes(uuid, uuid) TO anon, authenticated;