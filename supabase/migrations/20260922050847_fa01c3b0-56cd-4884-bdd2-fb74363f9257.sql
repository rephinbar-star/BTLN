CREATE OR REPLACE FUNCTION public.get_decode_for_session(p_id uuid, p_session_id uuid)
 RETURNS TABLE(id uuid, status text, result_json jsonb, source text, error_message text, relationship_id uuid, user_id uuid, session_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id, d.status, d.result_json, d.source, d.error_message,
         d.relationship_id, d.user_id, d.session_id
    FROM public.decodes d
   WHERE d.id = p_id
     AND (
       (auth.uid() IS NOT NULL AND d.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND d.session_id = p_session_id AND d.user_id IS NULL)
     )
   LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_analysis_for_session(p_id uuid, p_session_id uuid)
 RETURNS TABLE(id uuid, status text, result_json jsonb, context_data jsonb, message_count integer, error_message text, couple_type_id integer, relationship_type text, is_paid boolean, user_id uuid, session_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.status, a.result_json, a.context_data, a.message_count,
         a.error_message, a.couple_type_id, a.relationship_type,
         a.is_paid, a.user_id, a.session_id
    FROM public.analyses a
   WHERE a.id = p_id
     AND (
       (auth.uid() IS NOT NULL AND a.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND a.session_id = p_session_id AND a.user_id IS NULL)
     )
   LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.count_completed_decodes(p_session_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::integer
    FROM public.decodes d
   WHERE d.status = 'complete'
     AND (
       (p_session_id IS NOT NULL AND d.session_id = p_session_id AND d.user_id IS NULL)
       OR (auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() = p_user_id AND d.user_id = p_user_id)
     );
$function$;

CREATE OR REPLACE FUNCTION public.count_group_reads_since_cutoff(p_session_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::integer
    FROM public.group_reads g
   WHERE g.created_at >= timestamptz '2026-09-15 22:00:00+00'
     AND g.status <> 'failed'
     AND g.access_source = 'free'
     AND (
       (auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() = p_user_id AND g.user_id = p_user_id)
       OR (p_session_id IS NOT NULL AND g.session_id = p_session_id AND g.user_id IS NULL)
     );
$function$;