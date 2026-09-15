REVOKE EXECUTE ON FUNCTION public.user_has_active_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_recipient_perspective(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_recipient_perspective(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_active_subscription(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_recipient_perspective(text, integer, text) TO service_role;