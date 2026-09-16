-- Re-grant execute permissions that were accidentally revoked
GRANT EXECUTE ON FUNCTION public.submit_testimonial_candidate(uuid, uuid, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_approved_testimonials() TO anon, authenticated;

-- Ensure the public can view approved testimonials via the function as well (it already has security definer)
COMMENT ON FUNCTION public.list_approved_testimonials() IS 'Lists approved testimonials that have user consent.';

-- Add a policy for service_role to manage everything (redundant but good practice)
ALTER TABLE public.testimonial_candidates FORCE ROW LEVEL SECURITY;
