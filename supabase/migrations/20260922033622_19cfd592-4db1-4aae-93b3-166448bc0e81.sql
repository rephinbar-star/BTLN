ALTER FUNCTION public.journey_write_summary(uuid,text,uuid,jsonb,uuid[],jsonb,text,jsonb) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.journey_write_summary(uuid,text,uuid,jsonb,uuid[],jsonb,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey_write_summary(uuid,text,uuid,jsonb,uuid[],jsonb,text,jsonb) TO service_role;