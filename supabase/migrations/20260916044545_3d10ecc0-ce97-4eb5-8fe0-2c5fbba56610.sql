
-- 1. submit_feedback: require ownership (signed-in owner, or an unclaimed anonymous report)
CREATE OR REPLACE FUNCTION public.submit_feedback(p_analysis_id uuid, p_score integer, p_text text, p_email text, p_question_variant text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  IF p_score IS NOT NULL AND (p_score < 1 OR p_score > 10) THEN
    RAISE EXCEPTION 'feedback_score must be between 1 and 10';
  END IF;

  SELECT user_id INTO v_owner FROM public.analyses WHERE id = p_analysis_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'analysis not found';
  END IF;
  IF NOT ((auth.uid() IS NOT NULL AND v_owner = auth.uid()) OR v_owner IS NULL) THEN
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

CREATE OR REPLACE FUNCTION public.submit_feedback(p_analysis_id uuid, p_score integer, p_text text, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.submit_feedback(p_analysis_id, p_score, p_text, p_email, NULL::text);
END;
$function$;

-- 2. Explicit deny-all on internal tables reached only through SECURITY DEFINER / service_role
CREATE POLICY "No direct client access to messages_temp"
  ON public.messages_temp FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct client access to analysis_share_links"
  ON public.analysis_share_links FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct client access to roast_share_links"
  ON public.roast_share_links FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON public.messages_temp FROM anon, authenticated;
REVOKE ALL ON public.analysis_share_links FROM anon, authenticated;
REVOKE ALL ON public.roast_share_links FROM anon, authenticated;
GRANT ALL ON public.messages_temp TO service_role;
GRANT ALL ON public.analysis_share_links TO service_role;
GRANT ALL ON public.roast_share_links TO service_role;

-- 3. events: writes only through log_event()/service_role; admins may read
CREATE POLICY "Admins can read events"
  ON public.events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "No direct writes to events"
  ON public.events FOR INSERT TO anon, authenticated WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.events FROM anon, authenticated;
REVOKE SELECT ON public.events FROM anon;
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

-- 4. This function already rejects anonymous callers; stop exposing it to anon
REVOKE EXECUTE ON FUNCTION public.save_analysis_recipient_perspective(text, integer, text) FROM anon;
