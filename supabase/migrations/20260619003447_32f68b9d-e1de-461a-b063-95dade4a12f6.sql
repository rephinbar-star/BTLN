CREATE POLICY "Admins can view prompt versions"
ON public.prompt_versions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));