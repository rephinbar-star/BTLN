-- Evaluation data isolation (eval-isolation-1)
CREATE TABLE public.evaluation_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL,
  source_id uuid NOT NULL,
  run_id uuid NOT NULL,
  candidate_id uuid,
  variant text NOT NULL,
  target_user_id uuid NOT NULL,
  eval_scope text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id)
);
GRANT ALL ON public.evaluation_artifacts TO service_role;
GRANT SELECT ON public.evaluation_artifacts TO authenticated;
ALTER TABLE public.evaluation_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read evaluation artifacts" ON public.evaluation_artifacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.journey_sources
  ADD COLUMN IF NOT EXISTS evaluation_run_id uuid,
  ADD COLUMN IF NOT EXISTS quarantined_at timestamptz,
  ADD COLUMN IF NOT EXISTS quarantine_reason text;

-- Quarantined sources can never be re-included (by the owner toggle, a late job, or anything else).
CREATE OR REPLACE FUNCTION public.journey_keep_quarantine()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.quarantined_at IS NOT NULL THEN
    NEW.quarantined_at := OLD.quarantined_at;
    NEW.quarantine_reason := OLD.quarantine_reason;
    NEW.excluded_at := COALESCE(OLD.excluded_at, now());
    NEW.identity_status := OLD.identity_status;
  END IF;
  IF OLD.evaluation_run_id IS NOT NULL THEN NEW.evaluation_run_id := OLD.evaluation_run_id; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS journey_keep_quarantine ON public.journey_sources;
CREATE TRIGGER journey_keep_quarantine BEFORE UPDATE ON public.journey_sources FOR EACH ROW EXECUTE FUNCTION public.journey_keep_quarantine();

-- Observations may never be (re)written for a quarantined source.
CREATE OR REPLACE FUNCTION public.journey_block_quarantined_obs()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.journey_source_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.id = NEW.journey_source_id AND s.quarantined_at IS NOT NULL) THEN
    RAISE EXCEPTION 'source_quarantined';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS journey_block_quarantined_obs ON public.journey_observations;
CREATE TRIGGER journey_block_quarantined_obs BEFORE INSERT OR UPDATE ON public.journey_observations FOR EACH ROW EXECUTE FUNCTION public.journey_block_quarantined_obs();

-- Applying provenance (either order: before or after the source was staged).
CREATE OR REPLACE FUNCTION public.evaluation_artifact_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, user_id, relationship_id FROM public.journey_sources WHERE source_kind = NEW.source_kind AND source_id = NEW.source_id LOOP
    IF NEW.variant = 'candidate' THEN
      UPDATE public.journey_sources SET quarantined_at = now(), quarantine_reason = 'candidate_output:' || NEW.run_id, excluded_at = COALESCE(excluded_at, now()), evaluation_run_id = NEW.run_id WHERE id = r.id;
      DELETE FROM public.journey_observations WHERE journey_source_id = r.id;
      UPDATE public.journey_summaries SET is_stale = true WHERE user_id = r.user_id AND (relationship_id = r.relationship_id OR evidence_source_ids::text LIKE '%' || r.id::text || '%');
    ELSE
      UPDATE public.journey_sources SET evaluation_run_id = NEW.run_id WHERE id = r.id;
      UPDATE public.journey_summaries SET is_stale = true WHERE user_id = r.user_id AND relationship_id = r.relationship_id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.evaluation_artifact_apply() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER evaluation_artifact_apply AFTER INSERT ON public.evaluation_artifacts FOR EACH ROW EXECUTE FUNCTION public.evaluation_artifact_apply();

-- Staging paths honour provenance: candidate output is never staged; other evaluation output is eval-scoped.
CREATE OR REPLACE FUNCTION public.journey_stage_completed_source()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text := TG_ARGV[0];
  v_rel uuid; v_scope text; v_label text;
  v_meta public.report_ingest_meta%ROWTYPE;
  v_prior public.journey_sources%ROWTYPE;
  v_status text := 'pending';
  v_subject text := NULL;
  v_art public.evaluation_artifacts%ROWTYPE;
BEGIN
  IF NEW.status IS DISTINCT FROM 'complete' OR NEW.user_id IS NULL OR (TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM 'complete') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.journey_profiles p WHERE p.user_id=NEW.user_id AND p.opted_in_at IS NOT NULL AND p.auto_include_enabled AND p.activation_consent_at IS NOT NULL AND p.consent_version>=2) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.user_id=NEW.user_id AND s.source_kind=v_kind AND s.source_id=NEW.id) THEN RETURN NEW; END IF;
  SELECT * INTO v_art FROM public.evaluation_artifacts a WHERE a.source_kind = v_kind AND a.source_id = NEW.id;
  IF v_art.id IS NOT NULL AND v_art.variant = 'candidate' THEN RETURN NEW; END IF;

  SELECT * INTO v_meta FROM public.report_ingest_meta m WHERE m.source_kind = v_kind AND m.source_id = NEW.id;
  v_scope := CASE WHEN v_kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;

  IF v_meta.conversation_key IS NOT NULL THEN
    SELECT s.* INTO v_prior FROM public.journey_sources s JOIN public.journey_relationships r ON r.id = s.relationship_id
     WHERE s.user_id = NEW.user_id AND s.conversation_key = v_meta.conversation_key AND r.is_confirmed AND r.scope = v_scope
       AND s.quarantined_at IS NULL
       AND (s.evaluation_run_id IS NULL) = (v_art.id IS NULL)
       AND NOT EXISTS (SELECT 1 FROM public.journey_mapping_rejections x WHERE x.user_id = NEW.user_id AND x.conversation_key = v_meta.conversation_key AND x.relationship_id = r.id)
     ORDER BY s.updated_at DESC LIMIT 1;
    IF v_prior.id IS NOT NULL THEN
      v_rel := v_prior.relationship_id;
      IF v_prior.identity_status = 'confirmed' AND v_prior.subject_participant IS NOT NULL THEN v_status := 'confirmed'; v_subject := v_prior.subject_participant; END IF;
    END IF;
  END IF;

  IF v_rel IS NULL THEN
    v_label := CASE v_kind WHEN 'quick_take' THEN 'Quick Take' WHEN 'deep_read' THEN 'Deep Read' WHEN 'group_read' THEN 'Group Read' ELSE 'Group Roast' END
               || ' · ' || to_char(coalesce(NEW.created_at,now()), 'DD Mon YYYY');
    INSERT INTO public.journey_relationships(user_id,kind,label,scope,is_confirmed) VALUES(NEW.user_id,'unspecified',v_label,v_scope,false) RETURNING id INTO v_rel;
  END IF;

  INSERT INTO public.journey_sources(user_id,relationship_id,source_kind,source_id,identity_status,subject_participant,conversation_key,
      observed_period_start,observed_period_end,date_precision,date_provenance,dated_count,undated_count,date_note,evaluation_run_id)
  VALUES(NEW.user_id,v_rel,v_kind,NEW.id,v_status,v_subject,v_meta.conversation_key,v_meta.observed_start,v_meta.observed_end,
      COALESCE(v_meta.date_precision,'unknown'),COALESCE(v_meta.date_provenance,'unknown'),COALESCE(v_meta.dated_count,0),COALESCE(v_meta.undated_count,0),v_meta.date_note,v_art.run_id)
  ON CONFLICT(user_id,source_kind,source_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.journey_auto_include()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.journey_profiles%ROWTYPE;
  v_added integer := 0;
  r record; v_rel uuid; v_scope text; v_label text;
  v_meta public.report_ingest_meta%ROWTYPE;
  v_prior public.journey_sources%ROWTYPE;
  v_status text; v_subject text;
  v_art public.evaluation_artifacts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO v_profile FROM public.journey_profiles WHERE user_id = v_uid;
  IF v_profile.user_id IS NULL OR v_profile.opted_in_at IS NULL OR NOT v_profile.auto_include_enabled THEN RETURN 0; END IF;
  FOR r IN
    SELECT 'quick_take'::text AS kind, id, created_at FROM public.decodes WHERE user_id = v_uid AND status = 'complete'
    UNION ALL SELECT 'deep_read', id, created_at FROM public.analyses WHERE user_id = v_uid AND status = 'complete'
    UNION ALL SELECT 'group_read', id, created_at FROM public.group_reads WHERE user_id = v_uid AND status = 'complete'
    UNION ALL SELECT 'group_roast', id, created_at FROM public.group_roasts WHERE user_id = v_uid AND status = 'complete'
    ORDER BY created_at DESC LIMIT 200
  LOOP
    IF EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.user_id = v_uid AND s.source_kind = r.kind AND s.source_id = r.id) THEN CONTINUE; END IF;
    v_art := NULL;
    SELECT * INTO v_art FROM public.evaluation_artifacts a WHERE a.source_kind = r.kind AND a.source_id = r.id;
    IF v_art.id IS NOT NULL THEN CONTINUE; END IF; -- evaluation output is never auto-included
    v_scope := CASE WHEN r.kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;
    v_rel := NULL; v_status := 'pending'; v_subject := NULL; v_prior := NULL; v_meta := NULL;
    SELECT * INTO v_meta FROM public.report_ingest_meta m WHERE m.source_kind = r.kind AND m.source_id = r.id;
    IF v_meta.conversation_key IS NOT NULL THEN
      SELECT s.* INTO v_prior FROM public.journey_sources s JOIN public.journey_relationships rel ON rel.id = s.relationship_id
       WHERE s.user_id = v_uid AND s.conversation_key = v_meta.conversation_key AND rel.is_confirmed AND rel.scope = v_scope
         AND s.quarantined_at IS NULL AND s.evaluation_run_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.journey_mapping_rejections x WHERE x.user_id = v_uid AND x.conversation_key = v_meta.conversation_key AND x.relationship_id = rel.id)
       ORDER BY s.updated_at DESC LIMIT 1;
      IF v_prior.id IS NOT NULL THEN
        v_rel := v_prior.relationship_id;
        IF v_prior.identity_status = 'confirmed' AND v_prior.subject_participant IS NOT NULL THEN v_status := 'confirmed'; v_subject := v_prior.subject_participant; END IF;
      END IF;
    END IF;
    IF v_rel IS NULL THEN
      v_label := CASE r.kind WHEN 'quick_take' THEN 'Quick Take' WHEN 'deep_read' THEN 'Deep Read' WHEN 'group_read' THEN 'Group Read' ELSE 'Group Roast' END || ' · ' || to_char(r.created_at, 'DD Mon YYYY');
      INSERT INTO public.journey_relationships (user_id, kind, label, scope, is_confirmed) VALUES (v_uid, 'unspecified', v_label, v_scope, false) RETURNING id INTO v_rel;
    END IF;
    INSERT INTO public.journey_sources (user_id, relationship_id, source_kind, source_id, identity_status, subject_participant, conversation_key,
        observed_period_start, observed_period_end, date_precision, date_provenance, dated_count, undated_count, date_note)
    VALUES (v_uid, v_rel, r.kind, r.id, v_status, v_subject, v_meta.conversation_key, v_meta.observed_start, v_meta.observed_end,
        COALESCE(v_meta.date_precision,'unknown'), COALESCE(v_meta.date_provenance,'unknown'), COALESCE(v_meta.dated_count,0), COALESCE(v_meta.undated_count,0), v_meta.date_note);
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$function$;

-- Operator feedback aggregates exclude evaluation output.
CREATE OR REPLACE FUNCTION public.admin_ai_feedback_aggregate(p_days integer DEFAULT 30)
 RETURNS TABLE(source_kind text, target_kind text, model text, prompt_version text, reason_code text, up_count bigint, down_count bigint, sample_size bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
  SELECT f.source_kind, f.target_kind, f.model, f.prompt_version, rc.code,
         count(*) FILTER (WHERE f.rating = 'up'), count(*) FILTER (WHERE f.rating = 'down'), count(*)
  FROM public.ai_feedback f
  LEFT JOIN LATERAL unnest(COALESCE(NULLIF(f.reason_codes, '{}'), ARRAY[NULL]::text[])) AS rc(code) ON true
  WHERE f.created_at > now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365))
    AND NOT EXISTS (SELECT 1 FROM public.evaluation_artifacts a WHERE a.source_id::text = f.source_id::text)
  GROUP BY 1,2,3,4,5 ORDER BY 7 DESC;
END;
$function$;