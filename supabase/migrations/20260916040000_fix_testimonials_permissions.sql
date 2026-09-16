-- Fix the RPC to handle optional consent properly and not throw errors on withdrawal
CREATE OR REPLACE FUNCTION public.submit_testimonial_candidate(
  p_analysis_id uuid,
  p_session_id uuid,
  p_quote text,
  p_attribution text,
  p_publication_consent boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 7640
DECLARE
  v_id uuid;
  v_owner uuid;
  v_session uuid;
BEGIN
  -- Validate inputs for active consent
  IF p_publication_consent IS TRUE THEN
    IF char_length(trim(coalesce(p_quote, ''))) < 1 OR char_length(p_quote) > 1000 THEN
      RAISE EXCEPTION 'Invalid quote';
    END IF;
    IF char_length(trim(coalesce(p_attribution, ''))) < 1 OR char_length(p_attribution) > 80 THEN
      RAISE EXCEPTION 'Invalid attribution';
    END IF;
  END IF;

  -- Verify ownership/session
  SELECT user_id, session_id INTO v_owner, v_session
  FROM public.analyses WHERE id = p_analysis_id AND status = 'complete';

  IF NOT FOUND OR NOT (
    (auth.uid() IS NOT NULL AND v_owner = auth.uid())
    OR (v_owner IS NULL AND v_session = p_session_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this report';
  END IF;

  -- If consent withdrawn, delete the candidate
  IF p_publication_consent IS NOT TRUE THEN
    DELETE FROM public.testimonial_candidates 
    WHERE analysis_id = p_analysis_id AND (user_id = auth.uid() OR session_id = p_session_id);
    RETURN NULL;
  END IF;

  -- Upsert the candidate
  INSERT INTO public.testimonial_candidates (
    analysis_id, user_id, session_id, quote, attribution,
    publication_consent, consented_at, moderation_status, is_test
  ) VALUES (
    p_analysis_id, auth.uid(), p_session_id, trim(p_quote), trim(p_attribution),
    true, now(), 'pending', false
  )
  ON CONFLICT (analysis_id, session_id) DO UPDATE SET
    quote = EXCLUDED.quote,
    attribution = EXCLUDED.attribution,
    publication_consent = true,
    consented_at = now(),
    moderation_status = 'pending',
    moderated_at = null,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
7640;

-- Re-grant execute permissions that were accidentally revoked in previous migration
GRANT EXECUTE ON FUNCTION public.submit_testimonial_candidate(uuid, uuid, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_approved_testimonials() TO anon, authenticated;

-- Ensure table is readable by admins (service_role) and specific owners
ALTER TABLE public.testimonial_candidates ENABLE ROW LEVEL SECURITY;

-- Cleanup any existing duplicate policies if they exist, then create standard ones
DROP POLICY IF EXISTS "owners can view testimonial candidates" ON public.testimonial_candidates;
CREATE POLICY "owners can view testimonial candidates"
  ON public.testimonial_candidates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "public can view approved consented testimonials" ON public.testimonial_candidates;
CREATE POLICY "public can view approved consented testimonials"
  ON public.testimonial_candidates FOR SELECT TO anon, authenticated
  USING (
    publication_consent = true
    AND moderation_status = 'approved'
    AND is_test = false
  );
