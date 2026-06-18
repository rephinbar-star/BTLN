CREATE OR REPLACE FUNCTION public.get_shared_analysis(
  p_id uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  result_json jsonb,
  context_data jsonb,
  message_count integer,
  error_message text,
  couple_type_id integer,
  relationship_type text,
  is_paid boolean,
  user_id uuid,
  session_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.status, a.result_json, a.context_data, a.message_count,
         a.error_message, a.couple_type_id, a.relationship_type,
         a.is_paid, NULL::uuid AS user_id, NULL::uuid AS session_id
    FROM public.analyses a
   WHERE a.id = p_id
     AND a.status = 'complete'
     AND a.result_json IS NOT NULL
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_analysis(uuid) TO anon, authenticated;