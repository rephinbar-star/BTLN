CREATE OR REPLACE FUNCTION public.reserve_question_usage(
  p_user uuid, p_eval_run uuid, p_limit integer, p_started_version integer, p_usage jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
  v_id uuid;
BEGIN
  IF p_user IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid reservation';
  END IF;
  -- Serialise reservations per account (and per isolated test scope) for this transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('r360q:' || p_user::text || ':' || coalesce(p_eval_run::text, 'live'), 0));
  SELECT count(*) INTO v_used FROM public.journey_jobs
   WHERE user_id = p_user AND kind = 'question_answer'
     AND created_at >= now() - interval '24 hours'
     AND evaluation_run_id IS NOT DISTINCT FROM p_eval_run;
  IF v_used >= p_limit THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.journey_jobs (user_id, relationship_id, kind, status, started_from_version, evaluation_run_id, usage_json)
  VALUES (p_user, NULL, 'question_answer', 'pending', coalesce(p_started_version, 0), p_eval_run,
          jsonb_build_object('sources', coalesce((p_usage->>'sources')::int, 0), 'observations', coalesce((p_usage->>'observations')::int, 0), 'notes', coalesce((p_usage->>'notes')::int, 0)))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_question_usage(uuid, uuid, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_question_usage(uuid, uuid, integer, integer, jsonb) TO service_role;