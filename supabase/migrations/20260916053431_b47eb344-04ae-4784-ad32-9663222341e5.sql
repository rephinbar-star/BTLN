DROP FUNCTION IF EXISTS public.submit_feedback(uuid, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_analysis_id uuid,
  p_score integer,
  p_text text,
  p_email text,
  p_question_variant text DEFAULT NULL::text,
  p_session_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_session uuid;
BEGIN
  IF p_score IS NOT NULL AND (p_score < 1 OR p_score > 10) THEN
    RAISE EXCEPTION 'feedback_score must be between 1 and 10';
  END IF;

  SELECT user_id, session_id INTO v_owner, v_session
    FROM public.analyses WHERE id = p_analysis_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'analysis not found';
  END IF;

  -- Ownership capability: either the signed-in owner, or a caller that can
  -- present the report's own session id (an unguessable value held only by
  -- the browser that created it). A report UUID alone is never sufficient.
  IF NOT (
    (auth.uid() IS NOT NULL AND v_owner = auth.uid())
    OR (p_session_id IS NOT NULL AND v_session = p_session_id)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.analyses
     SET feedback_score = COALESCE(p_score, feedback_score),
         feedback_text  = COALESCE(p_text,  feedback_text),
         feedback_email = COALESCE(p_email, feedback_email),
         feedback_question_variant = COALESCE(p_question_variant, feedback_question_variant)
   WHERE id = p_analysis_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_feedback(uuid, integer, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_feedback(uuid, integer, text, text, text, uuid) TO anon, authenticated;