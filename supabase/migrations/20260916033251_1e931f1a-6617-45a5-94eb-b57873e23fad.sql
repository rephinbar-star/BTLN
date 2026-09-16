DROP POLICY IF EXISTS "public can view approved consented testimonials" ON public.testimonial_candidates;
REVOKE SELECT ON public.testimonial_candidates FROM anon;

CREATE VIEW public.approved_testimonials
WITH (security_barrier = true)
AS
SELECT id, quote, attribution
FROM public.testimonial_candidates
WHERE publication_consent = true
  AND moderation_status = 'approved'
  AND is_test = false;

REVOKE ALL ON public.approved_testimonials FROM PUBLIC;
GRANT SELECT ON public.approved_testimonials TO anon, authenticated;
GRANT ALL ON public.approved_testimonials TO service_role;