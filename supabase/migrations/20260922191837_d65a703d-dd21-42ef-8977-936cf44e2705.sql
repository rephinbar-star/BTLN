CREATE TABLE IF NOT EXISTS public.report_ingest_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('quick_take','deep_read','group_read','group_roast')),
  source_id uuid NOT NULL,
  conversation_key text,
  participant_fingerprint text,
  observed_start date,
  observed_end date,
  dated_count integer NOT NULL DEFAULT 0,
  undated_count integer NOT NULL DEFAULT 0,
  date_precision text NOT NULL DEFAULT 'unknown' CHECK (date_precision IN ('unknown','date','minute')),
  date_provenance text NOT NULL DEFAULT 'unknown' CHECK (date_provenance IN ('unknown','parsed','ocr_confirmed','user_supplied')),
  timezone_ambiguous boolean NOT NULL DEFAULT false,
  date_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id)
);

GRANT SELECT ON public.report_ingest_meta TO authenticated;
GRANT ALL ON public.report_ingest_meta TO service_role;
ALTER TABLE public.report_ingest_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their own ingest metadata"
  ON public.report_ingest_meta FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER report_ingest_meta_updated_at BEFORE UPDATE ON public.report_ingest_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.journey_mapping_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  relationship_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_key, relationship_id)
);

GRANT SELECT ON public.journey_mapping_rejections TO authenticated;
GRANT ALL ON public.journey_mapping_rejections TO service_role;
ALTER TABLE public.journey_mapping_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their own grouping corrections"
  ON public.journey_mapping_rejections FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.journey_sources
  ADD COLUMN IF NOT EXISTS date_precision text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS date_provenance text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS dated_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undated_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_note text;

-- Staging: copy verified exchange dates, and reuse a confirmed relationship only
-- when the SAME conversation identity was already confirmed and never rejected.
CREATE OR REPLACE FUNCTION public.journey_stage_completed_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text := TG_ARGV[0];
  v_rel uuid; v_scope text; v_label text;
  v_meta public.report_ingest_meta%ROWTYPE;
  v_prior public.journey_sources%ROWTYPE;
  v_status text := 'pending';
  v_subject text := NULL;
BEGIN
  IF NEW.status IS DISTINCT FROM 'complete' OR NEW.user_id IS NULL OR (TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM 'complete') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.journey_profiles p WHERE p.user_id=NEW.user_id AND p.opted_in_at IS NOT NULL AND p.auto_include_enabled AND p.activation_consent_at IS NOT NULL AND p.consent_version>=2) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.user_id=NEW.user_id AND s.source_kind=v_kind AND s.source_id=NEW.id) THEN RETURN NEW; END IF;

  SELECT * INTO v_meta FROM public.report_ingest_meta m WHERE m.source_kind = v_kind AND m.source_id = NEW.id AND m.user_id = NEW.user_id;
  v_scope := CASE WHEN v_kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;

  IF v_meta.conversation_key IS NOT NULL THEN
    SELECT s.* INTO v_prior
      FROM public.journey_sources s
      JOIN public.journey_relationships r ON r.id = s.relationship_id
     WHERE s.user_id = NEW.user_id
       AND s.conversation_key = v_meta.conversation_key
       AND r.is_confirmed
       AND r.scope = v_scope
       AND NOT EXISTS (
         SELECT 1 FROM public.journey_mapping_rejections x
          WHERE x.user_id = NEW.user_id AND x.conversation_key = v_meta.conversation_key AND x.relationship_id = r.id)
     ORDER BY s.updated_at DESC
     LIMIT 1;
    IF v_prior.id IS NOT NULL THEN
      v_rel := v_prior.relationship_id;
      -- The same thread keeps the participant mapping the person already confirmed.
      IF v_prior.identity_status = 'confirmed' AND v_prior.subject_participant IS NOT NULL THEN
        v_status := 'confirmed';
        v_subject := v_prior.subject_participant;
      END IF;
    END IF;
  END IF;

  IF v_rel IS NULL THEN
    v_label := CASE v_kind WHEN 'quick_take' THEN 'Quick Take' WHEN 'deep_read' THEN 'Deep Read' WHEN 'group_read' THEN 'Group Read' ELSE 'Group Roast' END
               || ' · ' || to_char(coalesce(NEW.created_at,now()), 'DD Mon YYYY');
    INSERT INTO public.journey_relationships(user_id,kind,label,scope,is_confirmed)
    VALUES(NEW.user_id,'unspecified',v_label,v_scope,false) RETURNING id INTO v_rel;
  END IF;

  INSERT INTO public.journey_sources(
      user_id,relationship_id,source_kind,source_id,identity_status,subject_participant,conversation_key,
      observed_period_start,observed_period_end,date_precision,date_provenance,dated_count,undated_count,date_note)
  VALUES(
      NEW.user_id,v_rel,v_kind,NEW.id,v_status,v_subject,v_meta.conversation_key,
      v_meta.observed_start,v_meta.observed_end,
      COALESCE(v_meta.date_precision,'unknown'),COALESCE(v_meta.date_provenance,'unknown'),
      COALESCE(v_meta.dated_count,0),COALESCE(v_meta.undated_count,0),v_meta.date_note)
  ON CONFLICT(user_id,source_kind,source_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_auto_include()
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.journey_profiles%ROWTYPE;
  v_added integer := 0;
  r record; v_rel uuid; v_scope text; v_label text;
  v_meta public.report_ingest_meta%ROWTYPE;
  v_prior public.journey_sources%ROWTYPE;
  v_status text; v_subject text;
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
    v_scope := CASE WHEN r.kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;
    v_rel := NULL; v_status := 'pending'; v_subject := NULL; v_prior := NULL;
    SELECT * INTO v_meta FROM public.report_ingest_meta m WHERE m.source_kind = r.kind AND m.source_id = r.id AND m.user_id = v_uid;

    IF v_meta.conversation_key IS NOT NULL THEN
      SELECT s.* INTO v_prior
        FROM public.journey_sources s
        JOIN public.journey_relationships rel ON rel.id = s.relationship_id
       WHERE s.user_id = v_uid AND s.conversation_key = v_meta.conversation_key AND rel.is_confirmed AND rel.scope = v_scope
         AND NOT EXISTS (SELECT 1 FROM public.journey_mapping_rejections x
                          WHERE x.user_id = v_uid AND x.conversation_key = v_meta.conversation_key AND x.relationship_id = rel.id)
       ORDER BY s.updated_at DESC LIMIT 1;
      IF v_prior.id IS NOT NULL THEN
        v_rel := v_prior.relationship_id;
        IF v_prior.identity_status = 'confirmed' AND v_prior.subject_participant IS NOT NULL THEN
          v_status := 'confirmed'; v_subject := v_prior.subject_participant;
        END IF;
      END IF;
    END IF;

    IF v_rel IS NULL THEN
      v_label := CASE r.kind WHEN 'quick_take' THEN 'Quick Take' WHEN 'deep_read' THEN 'Deep Read' WHEN 'group_read' THEN 'Group Read' ELSE 'Group Roast' END
                 || ' · ' || to_char(r.created_at, 'DD Mon YYYY');
      INSERT INTO public.journey_relationships (user_id, kind, label, scope, is_confirmed)
      VALUES (v_uid, 'unspecified', v_label, v_scope, false) RETURNING id INTO v_rel;
    END IF;

    INSERT INTO public.journey_sources (
        user_id, relationship_id, source_kind, source_id, identity_status, subject_participant, conversation_key,
        observed_period_start, observed_period_end, date_precision, date_provenance, dated_count, undated_count, date_note)
    VALUES (v_uid, v_rel, r.kind, r.id, v_status, v_subject, v_meta.conversation_key,
        v_meta.observed_start, v_meta.observed_end,
        COALESCE(v_meta.date_precision,'unknown'), COALESCE(v_meta.date_provenance,'unknown'),
        COALESCE(v_meta.dated_count,0), COALESCE(v_meta.undated_count,0), v_meta.date_note);
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

-- Moving a conversation records that the old grouping was rejected, so automatic
-- grouping can never put it back there.
CREATE OR REPLACE FUNCTION public.journey_assign_source(p_source_id uuid, p_relationship_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_src public.journey_sources%ROWTYPE; v_old uuid; v_scope text; v_target_scope text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO v_src FROM public.journey_sources WHERE id = p_source_id AND user_id = v_uid;
  IF v_src.id IS NULL THEN RETURN false; END IF;
  SELECT scope INTO v_scope FROM public.journey_relationships WHERE id = v_src.relationship_id;
  SELECT scope INTO v_target_scope FROM public.journey_relationships WHERE id = p_relationship_id AND user_id = v_uid;
  IF v_target_scope IS NULL THEN RAISE EXCEPTION 'relationship not found'; END IF;
  IF v_target_scope <> v_scope THEN RAISE EXCEPTION 'a group conversation and a two-person conversation cannot share a relationship'; END IF;

  v_old := v_src.relationship_id;
  UPDATE public.journey_sources SET relationship_id = p_relationship_id WHERE id = p_source_id AND user_id = v_uid;
  UPDATE public.journey_observations SET relationship_id = p_relationship_id WHERE user_id = v_uid AND journey_source_id = p_source_id;
  UPDATE public.journey_relationships SET is_confirmed = true WHERE id = p_relationship_id AND user_id = v_uid;

  IF v_src.conversation_key IS NOT NULL AND v_old IS DISTINCT FROM p_relationship_id THEN
    INSERT INTO public.journey_mapping_rejections(user_id, conversation_key, relationship_id)
    VALUES (v_uid, v_src.conversation_key, v_old)
    ON CONFLICT DO NOTHING;
    DELETE FROM public.journey_mapping_rejections
     WHERE user_id = v_uid AND conversation_key = v_src.conversation_key AND relationship_id = p_relationship_id;
  END IF;

  PERFORM public.journey_touch_relationship(v_uid, p_relationship_id);
  PERFORM public.journey_touch_relationship(v_uid, v_old);
  DELETE FROM public.journey_relationships r
   WHERE r.id = v_old AND r.user_id = v_uid AND NOT r.is_confirmed
     AND NOT EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.relationship_id = r.id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_split_source(p_source_id uuid, p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_src public.journey_sources%ROWTYPE; v_old uuid; v_scope text; v_new uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO v_src FROM public.journey_sources WHERE id = p_source_id AND user_id = v_uid;
  IF v_src.id IS NULL THEN RETURN NULL; END IF;
  SELECT scope INTO v_scope FROM public.journey_relationships WHERE id = v_src.relationship_id;
  v_old := v_src.relationship_id;
  INSERT INTO public.journey_relationships(user_id, kind, label, scope, is_confirmed)
  VALUES (v_uid, 'unspecified', COALESCE(NULLIF(trim(p_label), ''), 'Separated conversation'), v_scope, true)
  RETURNING id INTO v_new;
  UPDATE public.journey_sources SET relationship_id = v_new WHERE id = p_source_id AND user_id = v_uid;
  UPDATE public.journey_observations SET relationship_id = v_new WHERE user_id = v_uid AND journey_source_id = p_source_id;
  IF v_src.conversation_key IS NOT NULL THEN
    INSERT INTO public.journey_mapping_rejections(user_id, conversation_key, relationship_id)
    VALUES (v_uid, v_src.conversation_key, v_old) ON CONFLICT DO NOTHING;
  END IF;
  PERFORM public.journey_touch_relationship(v_uid, v_new);
  PERFORM public.journey_touch_relationship(v_uid, v_old);
  RETURN v_new;
END;
$$;

-- The person can supply or correct a period themselves. It is stored as
-- self-reported, never presented as verified, and invalidates cached profiles.
CREATE OR REPLACE FUNCTION public.journey_set_source_period(p_source_id uuid, p_start date, p_end date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_src public.journey_sources%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO v_src FROM public.journey_sources WHERE id = p_source_id AND user_id = v_uid;
  IF v_src.id IS NULL THEN RETURN false; END IF;
  IF p_start IS NOT NULL AND p_end IS NOT NULL AND p_end < p_start THEN RAISE EXCEPTION 'the end of the period cannot be before its start'; END IF;
  IF p_start IS NOT NULL AND p_start > current_date THEN RAISE EXCEPTION 'a conversation cannot have happened in the future'; END IF;
  IF p_end IS NOT NULL AND p_end > current_date THEN RAISE EXCEPTION 'a conversation cannot have happened in the future'; END IF;

  UPDATE public.journey_sources
     SET observed_period_start = p_start,
         observed_period_end = COALESCE(p_end, p_start),
         date_precision = CASE WHEN p_start IS NULL THEN 'unknown' ELSE 'date' END,
         date_provenance = CASE WHEN p_start IS NULL THEN 'unknown' ELSE 'user_supplied' END,
         date_note = CASE WHEN p_start IS NULL THEN NULL ELSE 'Period supplied by you; self-reported, not independently verified.' END,
         updated_at = now()
   WHERE id = p_source_id AND user_id = v_uid;

  UPDATE public.journey_observations
     SET observed_period_start = p_start, observed_period_end = COALESCE(p_end, p_start), updated_at = now()
   WHERE user_id = v_uid AND journey_source_id = p_source_id;

  PERFORM public.journey_touch_relationship(v_uid, v_src.relationship_id);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.journey_set_source_period(uuid, date, date) TO authenticated, service_role;