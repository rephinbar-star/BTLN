
CREATE TABLE public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  owner_key text GENERATED ALWAYS AS (COALESCE('user:' || user_id::text, 'session:' || session_id::text)) STORED,
  source_kind text NOT NULL CHECK (source_kind IN ('quick_take','deep_read','group_read','group_roast','interactive','relationship360')),
  source_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('overall','reply_option','section','recommendation','insight','introspection','turn','review','humor')),
  target_key text NOT NULL DEFAULT 'main',
  generation_id text,
  prompt_version text,
  model text,
  rating text NOT NULL CHECK (rating IN ('up','down')),
  reason_codes text[] NOT NULL DEFAULT '{}',
  comment text,
  outcome text CHECK (outcome IS NULL OR outcome IN ('used','not_used','modified','unknown')),
  outcome_note text,
  personalization_consent boolean NOT NULL DEFAULT true,
  product_improvement_consent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_feedback_owner_present CHECK (user_id IS NOT NULL OR session_id IS NOT NULL),
  CONSTRAINT ai_feedback_comment_len CHECK (comment IS NULL OR length(comment) <= 600),
  CONSTRAINT ai_feedback_outcome_note_len CHECK (outcome_note IS NULL OR length(outcome_note) <= 600),
  CONSTRAINT ai_feedback_reasons_len CHECK (array_length(reason_codes, 1) IS NULL OR array_length(reason_codes, 1) <= 8)
);

CREATE UNIQUE INDEX ai_feedback_target_unique
  ON public.ai_feedback (owner_key, source_kind, source_id, target_kind, target_key);
CREATE INDEX ai_feedback_source_idx ON public.ai_feedback (source_kind, source_id);
CREATE INDEX ai_feedback_user_idx ON public.ai_feedback (user_id, created_at DESC);
CREATE INDEX ai_feedback_agg_idx ON public.ai_feedback (source_kind, target_kind, rating, created_at DESC);

GRANT SELECT ON public.ai_feedback TO authenticated;
GRANT ALL ON public.ai_feedback TO service_role;

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their own feedback"
  ON public.ai_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER ai_feedback_set_updated_at
  BEFORE UPDATE ON public.ai_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Server-authoritative ownership check for a rated source.
CREATE OR REPLACE FUNCTION public.ai_feedback_owns_source(
  p_source_kind text,
  p_source_id uuid,
  p_session_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean := false;
BEGIN
  IF v_uid IS NULL AND p_session_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_source_kind = 'quick_take' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.decodes d
      WHERE d.id = p_source_id
        AND ((v_uid IS NOT NULL AND d.user_id = v_uid)
          OR (d.user_id IS NULL AND p_session_id IS NOT NULL AND d.session_id = p_session_id))
    ) INTO v_ok;
  ELSIF p_source_kind = 'deep_read' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = p_source_id
        AND ((v_uid IS NOT NULL AND a.user_id = v_uid)
          OR (a.user_id IS NULL AND p_session_id IS NOT NULL AND a.session_id = p_session_id))
    ) INTO v_ok;
  ELSIF p_source_kind = 'group_read' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.group_reads g
      WHERE g.id = p_source_id
        AND ((v_uid IS NOT NULL AND g.user_id = v_uid)
          OR (g.user_id IS NULL AND p_session_id IS NOT NULL AND g.session_id = p_session_id))
    ) INTO v_ok;
  ELSIF p_source_kind = 'group_roast' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.group_roasts r
      WHERE r.id = p_source_id AND v_uid IS NOT NULL AND r.user_id = v_uid
    ) INTO v_ok;
  ELSIF p_source_kind = 'interactive' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.interactive_threads t
      WHERE t.id = p_source_id AND v_uid IS NOT NULL AND t.user_id = v_uid
    ) INTO v_ok;
  ELSIF p_source_kind = 'relationship360' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.journey_summaries s
      WHERE s.id = p_source_id AND v_uid IS NOT NULL AND s.user_id = v_uid
    ) INTO v_ok;
  END IF;

  RETURN v_ok;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_feedback_owns_source(text, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.ai_feedback_owns_source(text, uuid, uuid) TO anon, authenticated, service_role;

-- Idempotent rate / re-rate. Updates in place; never inflates counts.
CREATE OR REPLACE FUNCTION public.submit_ai_feedback(
  p_source_kind text,
  p_source_id uuid,
  p_target_kind text,
  p_target_key text,
  p_rating text,
  p_session_id uuid DEFAULT NULL,
  p_generation_id text DEFAULT NULL,
  p_prompt_version text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_reason_codes text[] DEFAULT '{}',
  p_comment text DEFAULT NULL,
  p_outcome text DEFAULT NULL,
  p_outcome_note text DEFAULT NULL,
  p_personalization_consent boolean DEFAULT true,
  p_product_improvement_consent boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session uuid := CASE WHEN v_uid IS NULL THEN p_session_id ELSE NULL END;
  v_id uuid;
  v_recent integer;
BEGIN
  IF NOT public.ai_feedback_owns_source(p_source_kind, p_source_id, p_session_id) THEN
    RAISE EXCEPTION 'not authorized for this report';
  END IF;

  -- abuse control: bounded writes per owner per hour
  SELECT count(*) INTO v_recent
  FROM public.ai_feedback f
  WHERE f.owner_key = COALESCE('user:' || v_uid::text, 'session:' || v_session::text)
    AND f.updated_at > now() - interval '1 hour';
  IF v_recent > 300 THEN
    RAISE EXCEPTION 'too many feedback submissions, try later';
  END IF;

  INSERT INTO public.ai_feedback AS f (
    user_id, session_id, source_kind, source_id, target_kind, target_key,
    generation_id, prompt_version, model, rating, reason_codes, comment,
    outcome, outcome_note, personalization_consent, product_improvement_consent
  ) VALUES (
    v_uid, v_session, p_source_kind, p_source_id, p_target_kind, COALESCE(NULLIF(p_target_key, ''), 'main'),
    p_generation_id, p_prompt_version, p_model, p_rating,
    COALESCE(p_reason_codes, '{}'), NULLIF(btrim(COALESCE(p_comment, '')), ''),
    p_outcome, NULLIF(btrim(COALESCE(p_outcome_note, '')), ''),
    COALESCE(p_personalization_consent, true), COALESCE(p_product_improvement_consent, true)
  )
  ON CONFLICT (owner_key, source_kind, source_id, target_kind, target_key)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    reason_codes = EXCLUDED.reason_codes,
    comment = COALESCE(EXCLUDED.comment, f.comment),
    outcome = COALESCE(EXCLUDED.outcome, f.outcome),
    outcome_note = COALESCE(EXCLUDED.outcome_note, f.outcome_note),
    generation_id = COALESCE(EXCLUDED.generation_id, f.generation_id),
    prompt_version = COALESCE(EXCLUDED.prompt_version, f.prompt_version),
    model = COALESCE(EXCLUDED.model, f.model),
    personalization_consent = EXCLUDED.personalization_consent,
    product_improvement_consent = EXCLUDED.product_improvement_consent,
    updated_at = now()
  RETURNING f.id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_ai_feedback(text, uuid, text, text, text, uuid, text, text, text, text[], text, text, text, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_ai_feedback(text, uuid, text, text, text, uuid, text, text, text, text[], text, text, text, boolean, boolean) TO anon, authenticated, service_role;

-- Undo a rating.
CREATE OR REPLACE FUNCTION public.clear_ai_feedback(
  p_source_kind text,
  p_source_id uuid,
  p_target_kind text,
  p_target_key text,
  p_session_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text := COALESCE('user:' || auth.uid()::text, 'session:' || p_session_id::text);
BEGIN
  IF NOT public.ai_feedback_owns_source(p_source_kind, p_source_id, p_session_id) THEN
    RETURN false;
  END IF;
  DELETE FROM public.ai_feedback f
  WHERE f.owner_key = v_key
    AND f.source_kind = p_source_kind
    AND f.source_id = p_source_id
    AND f.target_kind = p_target_kind
    AND f.target_key = COALESCE(NULLIF(p_target_key, ''), 'main');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_ai_feedback(text, uuid, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.clear_ai_feedback(text, uuid, text, text, uuid) TO anon, authenticated, service_role;

-- Owner's existing ratings for one report (to render chosen state).
CREATE OR REPLACE FUNCTION public.list_ai_feedback_for_source(
  p_source_kind text,
  p_source_id uuid,
  p_session_id uuid DEFAULT NULL
) RETURNS TABLE(target_kind text, target_key text, rating text, reason_codes text[], comment text, outcome text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := COALESCE('user:' || auth.uid()::text, 'session:' || p_session_id::text);
BEGIN
  IF NOT public.ai_feedback_owns_source(p_source_kind, p_source_id, p_session_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT f.target_kind, f.target_key, f.rating, f.reason_codes, f.comment, f.outcome
  FROM public.ai_feedback f
  WHERE f.owner_key = v_key AND f.source_kind = p_source_kind AND f.source_id = p_source_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_ai_feedback_for_source(text, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_ai_feedback_for_source(text, uuid, uuid) TO anon, authenticated, service_role;

-- Compact, bounded, private personalization context for future generations.
-- Returns only non-content signals plus the user's own short notes, clearly
-- marked as untrusted user text by the consumer.
CREATE OR REPLACE FUNCTION public.get_coaching_feedback_context(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('version', 1, 'available', false);
  END IF;

  SELECT jsonb_build_object(
    'version', 1,
    'available', true,
    'liked_reasons', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('code', rc, 'count', count(*)) AS x
        FROM public.ai_feedback f, unnest(f.reason_codes) rc
        WHERE f.user_id = v_uid AND f.personalization_consent AND f.rating = 'up'
        GROUP BY rc ORDER BY count(*) DESC LIMIT 8
      ) s), '[]'::jsonb),
    'disliked_reasons', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('code', rc, 'count', count(*)) AS x
        FROM public.ai_feedback f, unnest(f.reason_codes) rc
        WHERE f.user_id = v_uid AND f.personalization_consent AND f.rating = 'down'
        GROUP BY rc ORDER BY count(*) DESC LIMIT 8
      ) s), '[]'::jsonb),
    'recent_notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('rating', t.rating, 'note', left(t.comment, 240)))
      FROM (
        SELECT f.rating, f.comment
        FROM public.ai_feedback f
        WHERE f.user_id = v_uid AND f.personalization_consent AND f.comment IS NOT NULL
        ORDER BY f.updated_at DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 20)
      ) t), '[]'::jsonb),
    'totals', COALESCE((
      SELECT jsonb_build_object(
        'up', count(*) FILTER (WHERE rating = 'up'),
        'down', count(*) FILTER (WHERE rating = 'down'))
      FROM public.ai_feedback WHERE user_id = v_uid AND personalization_consent
    ), '{}'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_coaching_feedback_context(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_coaching_feedback_context(integer) TO authenticated, service_role;

-- User controls: turn personalization off, or delete all their feedback.
CREATE OR REPLACE FUNCTION public.reset_coaching_personalization()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  UPDATE public.ai_feedback SET personalization_consent = false, updated_at = now()
  WHERE user_id = v_uid AND personalization_consent;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_coaching_personalization() FROM public;
GRANT EXECUTE ON FUNCTION public.reset_coaching_personalization() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_my_ai_feedback()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  DELETE FROM public.ai_feedback WHERE user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_ai_feedback() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_ai_feedback() TO authenticated, service_role;

-- Operator-only aggregate view. No free text, no content, no user ids.
CREATE OR REPLACE FUNCTION public.admin_ai_feedback_aggregate(p_days integer DEFAULT 30)
RETURNS TABLE(
  source_kind text,
  target_kind text,
  model text,
  prompt_version text,
  reason_code text,
  up_count bigint,
  down_count bigint,
  sample_size bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT f.source_kind, f.target_kind, f.model, f.prompt_version, rc.code,
         count(*) FILTER (WHERE f.rating = 'up'),
         count(*) FILTER (WHERE f.rating = 'down'),
         count(*)
  FROM public.ai_feedback f
  LEFT JOIN LATERAL unnest(COALESCE(NULLIF(f.reason_codes, '{}'), ARRAY[NULL]::text[])) AS rc(code) ON true
  WHERE f.created_at > now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365))
  GROUP BY 1,2,3,4,5
  ORDER BY 7 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_feedback_aggregate(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_ai_feedback_aggregate(integer) TO authenticated, service_role;
