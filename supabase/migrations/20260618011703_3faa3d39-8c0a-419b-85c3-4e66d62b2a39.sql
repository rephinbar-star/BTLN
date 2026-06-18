
-- 1. Role enum + user_roles table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. has_role security-definer helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 3. Seed admin user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'rephinbar@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Lock down couple_types storage bucket — admins only for write/update/delete
DROP POLICY IF EXISTS "Authenticated users can upload couple type images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update couple type images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete couple type images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload couple type images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update couple type images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete couple type images" ON storage.objects;

CREATE POLICY "Admins can upload couple type images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'couple_types' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update couple type images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'couple_types' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'couple_types' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete couple type images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'couple_types' AND public.has_role(auth.uid(), 'admin'));

-- 5. Lock down set_couple_type_image_url RPC to admins only
CREATE OR REPLACE FUNCTION public.set_couple_type_image_url(p_type_id integer, p_relationship_type text, p_image_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_col text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_relationship_type NOT IN ('romantic','friend','family') THEN
    RAISE EXCEPTION 'invalid relationship_type: %', p_relationship_type;
  END IF;
  v_col := 'image_url_' || p_relationship_type;
  EXECUTE format('UPDATE public.couple_types SET %I = $1 WHERE id = $2', v_col)
    USING p_image_url, p_type_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_couple_type_image_url(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_couple_type_image_url(integer, text, text) TO authenticated;
