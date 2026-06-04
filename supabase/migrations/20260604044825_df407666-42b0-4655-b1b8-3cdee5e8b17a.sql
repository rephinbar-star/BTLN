REVOKE ALL ON FUNCTION public.claim_analysis(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_analysis(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_analysis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analysis(uuid) TO service_role;