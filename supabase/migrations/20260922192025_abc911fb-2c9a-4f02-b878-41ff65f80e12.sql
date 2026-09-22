ALTER TABLE public.report_ingest_meta ALTER COLUMN user_id DROP NOT NULL;

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

  SELECT * INTO v_meta FROM public.report_ingest_meta m WHERE m.source_kind = v_kind AND m.source_id = NEW.id;
  v_scope := CASE WHEN v_kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;

  IF v_meta.conversation_key IS NOT NULL THEN
    SELECT s.* INTO v_prior
      FROM public.journey_sources s
      JOIN public.journey_relationships r ON r.id = s.relationship_id
     WHERE s.user_id = NEW.user_id
       AND s.conversation_key = v_meta.conversation_key
       AND r.is_confirmed AND r.scope = v_scope
       AND NOT EXISTS (
         SELECT 1 FROM public.journey_mapping_rejections x
          WHERE x.user_id = NEW.user_id AND x.conversation_key = v_meta.conversation_key AND x.relationship_id = r.id)
     ORDER BY s.updated_at DESC LIMIT 1;
    IF v_prior.id IS NOT NULL THEN
      v_rel := v_prior.relationship_id;
      IF v_prior.identity_status = 'confirmed' AND v_prior.subject_participant IS NOT NULL THEN
        v_status := 'confirmed'; v_subject := v_prior.subject_participant;
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
    v_rel := NULL; v_status := 'pending'; v_subject := NULL; v_prior := NULL; v_meta := NULL;
    SELECT * INTO v_meta FROM public.report_ingest_meta m WHERE m.source_kind = r.kind AND m.source_id = r.id;

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