-- Allow admins to read share_clicks for the admin dashboard.
-- The prior restrictive SELECT policy blocked all client reads, leaving
-- Admin "Share & download" stats at zero.

DROP POLICY IF EXISTS "Block direct reads on share_clicks" ON public.share_clicks;

CREATE POLICY "Admins can read share_clicks (restrictive)"
  ON public.share_clicks
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read share_clicks"
  ON public.share_clicks
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));