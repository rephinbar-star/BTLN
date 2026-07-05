CREATE OR REPLACE FUNCTION public.get_shared_analysis(p_id uuid)
 RETURNS TABLE(id uuid, status text, result_json jsonb, context_data jsonb, message_count integer, error_message text, couple_type_id integer, relationship_type text, is_paid boolean, user_id uuid, session_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id,
         a.status,
         a.result_json,
         jsonb_strip_nulls(jsonb_build_object(
           'name1', a.context_data->>'name1',
           'name2', a.context_data->>'name2',
           'relationship_stage', a.context_data->>'relationship_stage'
         )) AS context_data,
         a.message_count,
         NULL::text AS error_message,
         a.couple_type_id,
         a.relationship_type,
         a.is_paid,
         NULL::uuid AS user_id,
         NULL::uuid AS session_id
    FROM public.analyses a
   WHERE a.id = p_id
     AND a.status = 'complete'
     AND a.result_json IS NOT NULL
     AND a.couple_type_id IS NOT NULL
   LIMIT 1;
$function$;