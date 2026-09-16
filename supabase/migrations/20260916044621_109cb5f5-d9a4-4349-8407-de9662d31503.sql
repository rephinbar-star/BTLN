DROP FUNCTION IF EXISTS public.submit_feedback(uuid, integer, text, text);
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
