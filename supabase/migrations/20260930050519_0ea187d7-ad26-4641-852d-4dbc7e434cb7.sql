-- advice-review-1: per-item advice review state for Deep Read, with a hard shared attempt cap,
-- single-flight lease, short-lived evidence and stale-result protection. Server-only table.
CREATE TABLE public.advice_reviews (
  analysis_id uuid PRIMARY KEY REFERENCES public.analyses(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','complete','unavailable')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 3),
  checker_version text NOT NULL,
  pending jsonb,
  evidence jsonb,
  evidence_expires_at timestamptz,
  lease_until timestamptz,
  last_attempt_at timestamptz,
  terminal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attempts <= max_attempts),
  CHECK (status = 'pending' OR (evidence IS NULL AND pending IS NULL))
);
GRANT ALL ON public.advice_reviews TO service_role;
ALTER TABLE public.advice_reviews ENABLE ROW LEVEL SECURITY;
-- No client policies: only server functions (service role) read or write this table.

CREATE OR REPLACE FUNCTION public.advice_review_note(p_status text, p_verified int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_verified = 0
    THEN 'Your analysis is complete, but we couldn''t finish checking your suggestions, so we''ve left them out rather than show advice that might be meant for the wrong person.'
    ELSE 'Your analysis is complete. We couldn''t finish checking a few suggestions, so we''ve left those out rather than show advice that might be meant for the wrong person.' END
$$;

-- Terminal transition helper: clears evidence and marks the report's review unavailable.
CREATE OR REPLACE FUNCTION public.advice_review_terminate(p_analysis_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.advice_reviews SET status = 'unavailable', evidence = NULL, pending = NULL, evidence_expires_at = NULL,
    lease_until = NULL, terminal_reason = p_reason, updated_at = now()
  WHERE analysis_id = p_analysis_id AND status = 'pending';
  IF FOUND THEN
    UPDATE public.analyses a SET result_json = jsonb_set(jsonb_set(jsonb_set(a.result_json,
        '{advice_integrity,review,status}', '"unavailable"'),
        '{advice_integrity,review,can_retry}', 'false'),
        '{advice_integrity,note}', to_jsonb(public.advice_review_note('unavailable', COALESCE((a.result_json #>> '{advice_integrity,review,verified}')::int, 0))))
      || jsonb_build_object('advice_integrity', (jsonb_set(jsonb_set(jsonb_set(a.result_json,
        '{advice_integrity,review,status}', '"unavailable"'),
        '{advice_integrity,review,can_retry}', 'false'),
        '{advice_integrity,review,terminal_reason}', to_jsonb(p_reason)) -> 'advice_integrity')
        || jsonb_build_object('note', public.advice_review_note('unavailable', COALESCE((a.result_json #>> '{advice_integrity,review,verified}')::int, 0))))
    WHERE a.id = p_analysis_id AND a.result_json ? 'advice_integrity' AND a.result_json -> 'advice_integrity' ? 'review';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.expire_advice_reviews()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT analysis_id FROM public.advice_reviews WHERE status = 'pending' AND evidence_expires_at < now() FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.advice_review_terminate(r.analysis_id, 'evidence_expired'); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Atomic claim: single-flight lease, shared attempt cap, backoff, evidence expiry.
CREATE OR REPLACE FUNCTION public.claim_advice_review(p_analysis_id uuid, p_lease_seconds int DEFAULT 75, p_min_gap_seconds int DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.advice_reviews; a record;
BEGIN
  SELECT * INTO r FROM public.advice_reviews WHERE analysis_id = p_analysis_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_review'); END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'terminal_' || r.status); END IF;
  IF r.evidence IS NULL OR r.evidence_expires_at IS NULL OR r.evidence_expires_at < now() THEN
    PERFORM public.advice_review_terminate(p_analysis_id, 'evidence_expired');
    RETURN jsonb_build_object('ok', false, 'reason', 'evidence_expired');
  END IF;
  IF r.attempts >= r.max_attempts THEN
    PERFORM public.advice_review_terminate(p_analysis_id, 'attempts_exhausted');
    RETURN jsonb_build_object('ok', false, 'reason', 'attempts_exhausted');
  END IF;
  IF r.lease_until IS NOT NULL AND r.lease_until > now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'in_flight'); END IF;
  IF r.last_attempt_at IS NOT NULL AND r.last_attempt_at > now() - make_interval(secs => p_min_gap_seconds) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_soon');
  END IF;
  SELECT id, status, result_json INTO a FROM public.analyses WHERE id = p_analysis_id;
  IF a.status IS DISTINCT FROM 'complete' THEN
    PERFORM public.advice_review_terminate(p_analysis_id, 'report_changed');
    RETURN jsonb_build_object('ok', false, 'reason', 'report_changed');
  END IF;
  UPDATE public.advice_reviews SET attempts = attempts + 1, lease_until = now() + make_interval(secs => p_lease_seconds),
    last_attempt_at = now(), updated_at = now() WHERE analysis_id = p_analysis_id;
  RETURN jsonb_build_object('ok', true, 'attempt', r.attempts + 1, 'max_attempts', r.max_attempts, 'version', r.checker_version,
    'pending', r.pending, 'evidence', r.evidence, 'result', a.result_json, 'base_hash', md5(a.result_json::text));
END $$;

-- Finish: only the holder of the current attempt may write, and only if the report is byte-identical to what it read.
CREATE OR REPLACE FUNCTION public.finish_advice_review(p_analysis_id uuid, p_attempt int, p_base_hash text, p_new_result jsonb,
  p_remaining jsonb, p_status text, p_terminal_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.advice_reviews; cur jsonb; st text;
BEGIN
  IF p_status NOT IN ('pending','complete','unavailable') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_status'); END IF;
  SELECT * INTO r FROM public.advice_reviews WHERE analysis_id = p_analysis_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' OR r.attempts <> p_attempt THEN RETURN jsonb_build_object('ok', false, 'reason', 'stale_attempt'); END IF;
  SELECT result_json, status INTO cur, st FROM public.analyses WHERE id = p_analysis_id FOR UPDATE;
  IF cur IS NULL OR st IS DISTINCT FROM 'complete' OR md5(cur::text) <> p_base_hash THEN
    PERFORM public.advice_review_terminate(p_analysis_id, 'report_changed');
    RETURN jsonb_build_object('ok', false, 'reason', 'report_changed');
  END IF;
  IF p_new_result IS NOT NULL THEN UPDATE public.analyses SET result_json = p_new_result WHERE id = p_analysis_id; END IF;
  IF p_status = 'pending' AND r.attempts < r.max_attempts THEN
    UPDATE public.advice_reviews SET pending = p_remaining, lease_until = NULL, updated_at = now() WHERE analysis_id = p_analysis_id;
  ELSIF p_status = 'pending' THEN
    PERFORM public.advice_review_terminate(p_analysis_id, 'attempts_exhausted');
  ELSE
    UPDATE public.advice_reviews SET status = p_status, pending = NULL, evidence = NULL, evidence_expires_at = NULL, lease_until = NULL,
      terminal_reason = p_terminal_reason, updated_at = now() WHERE analysis_id = p_analysis_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Release a failed attempt's lease early (the attempt still counts toward the cap).
CREATE OR REPLACE FUNCTION public.release_advice_review(p_analysis_id uuid, p_attempt int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.advice_reviews;
BEGIN
  SELECT * INTO r FROM public.advice_reviews WHERE analysis_id = p_analysis_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' OR r.attempts <> p_attempt THEN RETURN; END IF;
  IF r.attempts >= r.max_attempts THEN PERFORM public.advice_review_terminate(p_analysis_id, 'attempts_exhausted');
  ELSE UPDATE public.advice_reviews SET lease_until = NULL, updated_at = now() WHERE analysis_id = p_analysis_id; END IF;
END $$;

REVOKE ALL ON FUNCTION public.advice_review_terminate(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_advice_reviews() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_advice_review(uuid, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_advice_review(uuid, int, text, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_advice_review(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advice_review_terminate(uuid, text), public.expire_advice_reviews(), public.claim_advice_review(uuid, int, int),
  public.finish_advice_review(uuid, int, text, jsonb, jsonb, text, text), public.release_advice_review(uuid, int) TO service_role;
