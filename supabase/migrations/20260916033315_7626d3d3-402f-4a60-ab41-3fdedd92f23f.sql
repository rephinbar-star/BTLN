ALTER VIEW public.approved_testimonials SET (security_invoker = true);
REVOKE SELECT ON public.approved_testimonials FROM anon, authenticated;