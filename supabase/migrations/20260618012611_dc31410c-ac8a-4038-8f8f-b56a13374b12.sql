
-- Remove overly permissive storage policies; keep only admin-scoped ones
DROP POLICY IF EXISTS "Authenticated can upload couple type images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update couple type images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete couple type images" ON storage.objects;

-- Lock down internal SECURITY DEFINER helpers that should not be callable from the API
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_paid_access(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
