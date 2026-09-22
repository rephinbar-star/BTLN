ALTER FUNCTION public.has_entitlement(text) SECURITY INVOKER;
ALTER FUNCTION public.journey_source_participants(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.journey_confirm_identity(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.journey_validate_source() SECURITY INVOKER;
ALTER FUNCTION public.journey_set_source_excluded(uuid, boolean) SECURITY INVOKER;
ALTER FUNCTION public.journey_opt_out() SECURITY INVOKER;
ALTER FUNCTION public.journey_export() SECURITY INVOKER;