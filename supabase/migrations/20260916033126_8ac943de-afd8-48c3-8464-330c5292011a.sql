REVOKE EXECUTE ON FUNCTION public.submit_testimonial_candidate(uuid, uuid, text, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_approved_testimonials() FROM anon, authenticated;

GRANT SELECT ON public.testimonial_candidates TO anon;

CREATE POLICY "public can view approved consented testimonials"
  ON public.testimonial_candidates FOR SELECT TO anon, authenticated
  USING (
    publication_consent = true
    AND moderation_status = 'approved'
    AND is_test = false
  );