CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_event_id_unique
  ON public.webhook_events(event_id)
  WHERE event_id IS NOT NULL;

CREATE TABLE public.testimonial_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  quote text NOT NULL CHECK (char_length(quote) BETWEEN 1 AND 1000),
  attribution text NOT NULL DEFAULT 'Anonymous' CHECK (char_length(attribution) BETWEEN 1 AND 80),
  publication_consent boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  is_test boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, session_id)
);

GRANT SELECT ON public.testimonial_candidates TO authenticated;
GRANT ALL ON public.testimonial_candidates TO service_role;
ALTER TABLE public.testimonial_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners can view testimonial candidates"
  ON public.testimonial_candidates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_testimonial_candidates_updated_at
  BEFORE UPDATE ON public.testimonial_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
AS $$
DECLARE
  v_id uuid;
  v_owner uuid;
  v_session uuid;
BEGIN
  IF p_publication_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Publication consent is required';
  END IF;
  IF char_length(trim(coalesce(p_quote, ''))) < 1 OR char_length(p_quote) > 1000 THEN
    RAISE EXCEPTION 'Invalid quote';
  END IF;
  IF char_length(trim(coalesce(p_attribution, ''))) < 1 OR char_length(p_attribution) > 80 THEN
    RAISE EXCEPTION 'Invalid attribution';
  END IF;

  SELECT user_id, session_id INTO v_owner, v_session
  FROM public.analyses WHERE id = p_analysis_id AND status = 'complete';

  IF NOT FOUND OR NOT (
    (auth.uid() IS NOT NULL AND v_owner = auth.uid())
    OR (v_owner IS NULL AND v_session = p_session_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this report';
  END IF;

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
$$;

REVOKE EXECUTE ON FUNCTION public.submit_testimonial_candidate(uuid, uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_testimonial_candidate(uuid, uuid, text, text, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_approved_testimonials()
RETURNS TABLE(id uuid, quote text, attribution text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.quote, t.attribution
  FROM public.testimonial_candidates t
  WHERE t.publication_consent = true
    AND t.moderation_status = 'approved'
    AND t.is_test = false
  ORDER BY t.moderated_at DESC NULLS LAST
  LIMIT 12;
$$;

REVOKE EXECUTE ON FUNCTION public.list_approved_testimonials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_approved_testimonials() TO anon, authenticated, service_role;