
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS feedback_question_variant text;
ALTER TABLE public.general_feedback ADD COLUMN IF NOT EXISTS question_variant text;

CREATE OR REPLACE FUNCTION public.submit_feedback(p_analysis_id uuid, p_score integer, p_text text, p_email text, p_question_variant text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_score IS NOT NULL AND (p_score < 1 OR p_score > 10) THEN
    RAISE EXCEPTION 'feedback_score must be between 1 and 10';
  END IF;

  UPDATE public.analyses
     SET feedback_score = COALESCE(p_score, feedback_score),
         feedback_text  = COALESCE(p_text,  feedback_text),
         feedback_email = COALESCE(p_email, feedback_email),
         feedback_question_variant = COALESCE(p_question_variant, feedback_question_variant)
   WHERE id = p_analysis_id;
END;
$function$;
