REVOKE ALL ON public.decode_unlocks FROM anon,authenticated;
GRANT SELECT ON public.decode_unlocks TO authenticated;
GRANT ALL ON public.decode_unlocks TO service_role;