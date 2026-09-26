REVOKE EXECUTE ON FUNCTION public.is_evaluation_user(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.classify_evaluation_event() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.classify_evaluation_analysis() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluation_artifact_mark_analysis() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_evaluation_user(uuid) TO service_role;