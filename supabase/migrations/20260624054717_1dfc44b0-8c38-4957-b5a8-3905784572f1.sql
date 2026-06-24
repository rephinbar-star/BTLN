-- Survey responses: free-text feedback + email captured during the post-report survey.
-- Sensitive fields (feedback_text, email) live ONLY here, never in PostHog.
CREATE TABLE public.survey_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accuracy_rating integer NOT NULL CHECK (accuracy_rating BETWEEN 1 AND 10),
  question_variant text NOT NULL CHECK (question_variant IN ('wrong','balanced')),
  feedback_text text,
  email text,
  trigger_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Owner-only reads. No public read. Writes go through submit_survey RPC.
CREATE POLICY "Owners can read their own survey responses"
ON public.survey_responses
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Paywall intents: a click on a paid option (not necessarily a purchase).
CREATE TABLE public.paywall_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  option text NOT NULL CHECK (option IN ('one_time','monthly','annual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.paywall_intents TO authenticated;
GRANT ALL ON public.paywall_intents TO service_role;

ALTER TABLE public.paywall_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own paywall intents"
ON public.paywall_intents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Submit survey: validates analysis ownership (auth user OR matching session_id for anon).
CREATE OR REPLACE FUNCTION public.submit_survey(
  p_analysis_id uuid,
  p_session_id uuid,
  p_accuracy_rating integer,
  p_question_variant text,
  p_feedback_text text,
  p_email text,
  p_trigger_source text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_session uuid;
  v_id uuid;
BEGIN
  IF p_accuracy_rating IS NULL OR p_accuracy_rating < 1 OR p_accuracy_rating > 10 THEN
    RAISE EXCEPTION 'accuracy_rating must be between 1 and 10';
  END IF;
  IF p_question_variant NOT IN ('wrong','balanced') THEN
    RAISE EXCEPTION 'invalid question_variant';
  END IF;

  IF p_analysis_id IS NOT NULL THEN
    SELECT user_id, session_id INTO v_owner, v_session
      FROM public.analyses WHERE id = p_analysis_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'analysis not found';
    END IF;
    IF NOT (
      (auth.uid() IS NOT NULL AND v_owner = auth.uid())
      OR (p_session_id IS NOT NULL AND v_session = p_session_id)
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  INSERT INTO public.survey_responses(
    analysis_id, user_id, accuracy_rating, question_variant,
    feedback_text, email, trigger_source
  ) VALUES (
    p_analysis_id, auth.uid(), p_accuracy_rating, p_question_variant,
    NULLIF(trim(coalesce(p_feedback_text,'')), ''),
    NULLIF(trim(coalesce(p_email,'')), ''),
    p_trigger_source
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Record paywall intent click.
CREATE OR REPLACE FUNCTION public.record_paywall_intent(
  p_analysis_id uuid,
  p_session_id uuid,
  p_option text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_session uuid;
  v_id uuid;
BEGIN
  IF p_option NOT IN ('one_time','monthly','annual') THEN
    RAISE EXCEPTION 'invalid option';
  END IF;

  IF p_analysis_id IS NOT NULL THEN
    SELECT user_id, session_id INTO v_owner, v_session
      FROM public.analyses WHERE id = p_analysis_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'analysis not found';
    END IF;
    IF NOT (
      (auth.uid() IS NOT NULL AND v_owner = auth.uid())
      OR (p_session_id IS NOT NULL AND v_session = p_session_id)
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  INSERT INTO public.paywall_intents(analysis_id, user_id, option)
  VALUES (p_analysis_id, auth.uid(), p_option)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;