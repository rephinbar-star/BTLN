-- advice-review-2: no retained transcript. Original processing does initial + one automatic
-- retry only. Post-completion recovery requires the owner to resubmit the same input,
-- matched by a keyed, non-reversible server-side fingerprint. One recovery per report.
DROP FUNCTION IF EXISTS public.claim_advice_review(uuid, int, int);
DROP FUNCTION IF EXISTS public.finish_advice_review(uuid, int, text, jsonb, jsonb, text, text);
DROP FUNCTION IF EXISTS public.release_advice_review(uuid, int);

ALTER TABLE public.advice_reviews DROP CONSTRAINT IF EXISTS advice_reviews_check1;
ALTER TABLE public.advice_reviews DROP CONSTRAINT IF EXISTS advice_reviews_check;
ALTER TABLE public.advice_reviews DROP CONSTRAINT IF EXISTS advice_reviews_status_check;
ALTER TABLE public.advice_reviews DROP CONSTRAINT IF EXISTS advice_reviews_max_attempts_check;
ALTER TABLE public.advice_reviews DROP COLUMN IF EXISTS evidence;
ALTER TABLE public.advice_reviews DROP COLUMN IF EXISTS evidence_expires_at;
ALTER TABLE public.advice_reviews
  ADD COLUMN IF NOT EXISTS input_fp text,
  ADD COLUMN IF NOT EXISTS fp_version text,
  ADD COLUMN IF NOT EXISTS recovery_state text NOT NULL DEFAULT 'not_available',
  ADD COLUMN IF NOT EXISTS recovery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_mismatches integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_lease_until timestamptz;
ALTER TABLE public.advice_reviews
  ADD CONSTRAINT advice_reviews_status_chk CHECK (status IN ('pending','complete','unavailable')),
  ADD CONSTRAINT advice_reviews_attempts_chk CHECK (max_attempts BETWEEN 1 AND 2 OR attempts <= 3),
  ADD CONSTRAINT advice_reviews_recovery_state_chk CHECK (recovery_state IN ('not_available','available','claimed','complete','unavailable')),
  ADD CONSTRAINT advice_reviews_recovery_attempts_chk CHECK (recovery_attempts BETWEEN 0 AND 2),
  -- Hidden advice items (report-derived text, never transcript) are kept only while a recovery is possible.
  ADD CONSTRAINT advice_reviews_pending_chk CHECK (pending IS NULL OR recovery_state IN ('available','claimed')),
  ADD CONSTRAINT advice_reviews_fp_chk CHECK (recovery_state NOT IN ('available','claimed') OR input_fp IS NOT NULL);

CREATE OR REPLACE FUNCTION public.advice_review_note(p_status text, p_verified int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_verified = 0
    THEN 'Your analysis is complete, but your suggestions couldn''t be checked, so we''ve left them out rather than show advice that might be meant for the wrong person.'
    ELSE 'Your analysis is complete. Some suggestions couldn''t be checked, so we''ve left them out.' END
$$;

-- Terminal: no recovery; clears hidden items; report says suggestions unavailable.
CREATE OR REPLACE FUNCTION public.advice_review_terminate(p_analysis_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v int;
BEGIN
  UPDATE public.advice_reviews SET status = CASE WHEN status = 'complete' THEN 'complete' ELSE 'unavailable' END,
    pending = NULL, recovery_state = CASE WHEN recovery_state IN ('available','claimed') THEN 'unavailable' ELSE recovery_state END,
    recovery_lease_until = NULL, lease_until = NULL, terminal_reason = COALESCE(terminal_reason, p_reason), updated_at = now()
  WHERE analysis_id = p_analysis_id AND (pending IS NOT NULL OR status = 'pending' OR recovery_state IN ('available','claimed'));
  IF FOUND THEN
    UPDATE public.analyses a SET result_json = jsonb_set(a.result_json, '{advice_integrity}',
        (a.result_json -> 'advice_integrity')
        || jsonb_build_object('note', public.advice_review_note('unavailable', COALESCE((a.result_json #>> '{advice_integrity,review,verified}')::int, 0)))
        || jsonb_build_object('review', (a.result_json #> '{advice_integrity,review}')
             || jsonb_build_object('status', 'unavailable', 'can_retry', false, 'can_recover', false, 'recovery', 'unavailable', 'terminal_reason', p_reason)))
    WHERE a.id = p_analysis_id AND jsonb_typeof(a.result_json #> '{advice_integrity,review}') = 'object'
      AND (a.result_json #>> '{advice_integrity,review,status}') <> 'complete';
  END IF;
END $$;

-- Crashed/abandoned recovery jobs: lease expiry ends the single recovery (it was consumed).
CREATE OR REPLACE FUNCTION public.expire_advice_reviews()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT analysis_id FROM public.advice_reviews
    WHERE (recovery_state = 'claimed' AND (recovery_lease_until IS NULL OR recovery_lease_until < now())) OR status = 'pending'
    FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.advice_review_terminate(r.analysis_id, 'recovery_abandoned'); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Atomic recovery claim. Fingerprint mismatch does not consume the recovery (bounded to 10 mismatches).
CREATE OR REPLACE FUNCTION public.claim_advice_recovery(p_analysis_id uuid, p_input_fp text, p_fp_version text, p_lease_seconds int DEFAULT 150)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.advice_reviews; a record;
BEGIN
  SELECT * INTO r FROM public.advice_reviews WHERE analysis_id = p_analysis_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_review'); END IF;
  IF r.recovery_state = 'claimed' THEN RETURN jsonb_build_object('ok', false, 'reason', 'in_flight'); END IF;
  IF r.recovery_state IN ('complete','unavailable') THEN RETURN jsonb_build_object('ok', false, 'reason', 'recovery_used'); END IF;
  IF r.recovery_state <> 'available' OR r.pending IS NULL OR r.input_fp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_recoverable'); END IF;
  IF r.recovery_mismatches >= 10 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_mismatches'); END IF;
  IF p_fp_version IS DISTINCT FROM r.fp_version OR p_input_fp IS DISTINCT FROM r.input_fp THEN
    UPDATE public.advice_reviews SET recovery_mismatches = recovery_mismatches + 1, updated_at = now() WHERE analysis_id = p_analysis_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'input_mismatch');
  END IF;
  SELECT id, status, result_json INTO a FROM public.analyses WHERE id = p_analysis_id FOR UPDATE;
  IF a.status IS DISTINCT FROM 'complete' THEN
    PERFORM public.advice_review_terminate(p_analysis_id, 'report_changed');
    RETURN jsonb_build_object('ok', false, 'reason', 'report_changed');
  END IF;
  UPDATE public.advice_reviews SET recovery_state = 'claimed', recovery_lease_until = now() + make_interval(secs => p_lease_seconds),
    updated_at = now() WHERE analysis_id = p_analysis_id;
  RETURN jsonb_build_object('ok', true, 'version', r.checker_version, 'pending', r.pending, 'result', a.result_json, 'base_hash', md5(a.result_json::text));
END $$;

-- Finish recovery: only while the lease is held and the report is byte-identical to what was read.
CREATE OR REPLACE FUNCTION public.finish_advice_recovery(p_analysis_id uuid, p_base_hash text, p_new_result jsonb, p_status text, p_attempts int, p_terminal_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.advice_reviews; cur jsonb; st text;
BEGIN
  IF p_status NOT IN ('complete','unavailable') OR p_attempts NOT BETWEEN 0 AND 2 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_input'); END IF;
  SELECT * INTO r FROM public.advice_reviews WHERE analysis_id = p_analysis_id FOR UPDATE;
  IF NOT FOUND OR r.recovery_state <> 'claimed' OR r.recovery_lease_until < now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'stale_attempt'); END IF;
  SELECT result_json, status INTO cur, st FROM public.analyses WHERE id = p_analysis_id FOR UPDATE;
  IF cur IS NULL OR st IS DISTINCT FROM 'complete' OR md5(cur::text) <> p_base_hash THEN
    UPDATE public.advice_reviews SET recovery_attempts = p_attempts WHERE analysis_id = p_analysis_id;
    PERFORM public.advice_review_terminate(p_analysis_id, 'report_changed');
    RETURN jsonb_build_object('ok', false, 'reason', 'report_changed');
  END IF;
  IF p_new_result IS NOT NULL THEN UPDATE public.analyses SET result_json = p_new_result WHERE id = p_analysis_id; END IF;
  UPDATE public.advice_reviews SET status = p_status, pending = NULL, recovery_state = p_status, recovery_attempts = p_attempts,
    recovery_lease_until = NULL, terminal_reason = p_terminal_reason, updated_at = now() WHERE analysis_id = p_analysis_id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.advice_review_terminate(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_advice_reviews() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_advice_recovery(uuid, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_advice_recovery(uuid, text, jsonb, text, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advice_review_terminate(uuid, text), public.expire_advice_reviews(),
  public.claim_advice_recovery(uuid, text, text, int), public.finish_advice_recovery(uuid, text, jsonb, text, int, text) TO service_role;