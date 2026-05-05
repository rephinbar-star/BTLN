REVOKE EXECUTE ON FUNCTION public.claim_analyses_for_session(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_analyses_for_session(uuid) TO authenticated;