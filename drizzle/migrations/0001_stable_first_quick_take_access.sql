CREATE OR REPLACE FUNCTION public.decode_access_allowed(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.decodes d WHERE d.id=p_id AND (
 EXISTS (SELECT 1 FROM public.user_subscriptions s WHERE s.user_id=d.user_id AND s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
 OR EXISTS (SELECT 1 FROM public.decode_unlocks u WHERE u.decode_id=d.id AND u.user_id=d.user_id)
 OR NOT EXISTS (SELECT 1 FROM public.decodes earlier WHERE (earlier.created_at,earlier.id)<(d.created_at,d.id)
 AND ((d.user_id IS NOT NULL AND earlier.user_id=d.user_id) OR (earlier.session_id=d.session_id AND earlier.user_id IS NULL))
 AND NOT EXISTS (SELECT 1 FROM public.evaluation_artifacts e WHERE e.source_id=earlier.id AND e.source_kind='quick_take'))
 ));
$$;
REVOKE ALL ON FUNCTION public.decode_access_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.decode_access_allowed(uuid) TO service_role;