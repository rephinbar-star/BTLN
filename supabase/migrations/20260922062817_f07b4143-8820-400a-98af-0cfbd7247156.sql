ALTER TABLE public.journey_relationships ADD COLUMN IF NOT EXISTS is_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.journey_sources ADD COLUMN IF NOT EXISTS conversation_key text;

UPDATE public.journey_relationships SET is_confirmed = true WHERE kind <> 'unspecified';

CREATE INDEX IF NOT EXISTS journey_sources_conversation_key_idx
  ON public.journey_sources (user_id, conversation_key) WHERE conversation_key IS NOT NULL;

-- Mark every summary that touches a relationship as out of date.
CREATE OR REPLACE FUNCTION public.journey_touch_relationship(p_user uuid, p_rel uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.journey_relationships SET data_version = data_version + 1, updated_at = now() WHERE id = p_rel AND user_id = p_user;
  UPDATE public.journey_profiles SET data_version = data_version + 1 WHERE user_id = p_user;
  UPDATE public.journey_summaries SET is_stale = true
   WHERE user_id = p_user AND (relationship_id = p_rel OR scope = 'cross_relationship');
  UPDATE public.journey_jobs SET status = 'cancelled'
   WHERE user_id = p_user AND status IN ('pending','running') AND (relationship_id = p_rel OR relationship_id IS NULL);
END;
$$;

-- Candidate relationships for an unresolved conversation. Labels are not identity:
-- these are suggestions the person confirms, never an automatic merge.
CREATE OR REPLACE FUNCTION public.journey_suggest_relationships(p_source_id uuid)
RETURNS TABLE(id uuid, label text, kind text, scope text, is_confirmed boolean, source_count bigint, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_src public.journey_sources%ROWTYPE; v_scope text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO v_src FROM public.journey_sources WHERE journey_sources.id = p_source_id AND user_id = v_uid;
  IF v_src.id IS NULL THEN RETURN; END IF;
  SELECT r.scope INTO v_scope FROM public.journey_relationships r WHERE r.id = v_src.relationship_id;

  RETURN QUERY
  SELECT r.id, r.label, r.kind, r.scope, r.is_confirmed,
         (SELECT count(*) FROM public.journey_sources s2 WHERE s2.relationship_id = r.id) AS source_count,
         CASE WHEN EXISTS (
                SELECT 1 FROM public.journey_sources s3
                 WHERE s3.relationship_id = r.id AND s3.user_id = v_uid
                   AND v_src.conversation_key IS NOT NULL
                   AND s3.conversation_key = v_src.conversation_key)
              THEN 'same_conversation' ELSE 'same_kind_of_conversation' END AS reason
    FROM public.journey_relationships r
   WHERE r.user_id = v_uid AND r.id <> v_src.relationship_id AND r.scope = v_scope AND r.is_confirmed
   ORDER BY 7 DESC, r.updated_at DESC
   LIMIT 8;
END;
$$;

-- Confirm the relationship a conversation already sits in, optionally renaming it.
CREATE OR REPLACE FUNCTION public.journey_confirm_relationship(p_relationship_id uuid, p_label text, p_kind text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  UPDATE public.journey_relationships
     SET is_confirmed = true,
         label = COALESCE(NULLIF(trim(p_label), ''), label),
         kind = COALESCE(NULLIF(trim(p_kind), ''), kind)
   WHERE id = p_relationship_id AND user_id = v_uid;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.journey_touch_relationship(v_uid, p_relationship_id);
  RETURN true;
END;
$$;

-- Move one conversation into another relationship the person owns.
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

  PERFORM public.journey_touch_relationship(v_uid, p_relationship_id);
  PERFORM public.journey_touch_relationship(v_uid, v_old);
  -- An auto-created relationship left with nothing in it is noise, not history.
  DELETE FROM public.journey_relationships r
   WHERE r.id = v_old AND r.user_id = v_uid AND NOT r.is_confirmed
     AND NOT EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.relationship_id = r.id);
  RETURN true;
END;
$$;

-- Split a conversation back out into its own relationship (the undo for a wrong merge).
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
  PERFORM public.journey_touch_relationship(v_uid, v_new);
  PERFORM public.journey_touch_relationship(v_uid, v_old);
  RETURN v_new;
END;
$$;

-- Merge two relationships the person says are the same people.
CREATE OR REPLACE FUNCTION public.journey_merge_relationships(p_from uuid, p_into uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_from public.journey_relationships%ROWTYPE; v_into public.journey_relationships%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  IF p_from = p_into THEN RETURN false; END IF;
  SELECT * INTO v_from FROM public.journey_relationships WHERE id = p_from AND user_id = v_uid;
  SELECT * INTO v_into FROM public.journey_relationships WHERE id = p_into AND user_id = v_uid;
  IF v_from.id IS NULL OR v_into.id IS NULL THEN RETURN false; END IF;
  IF v_from.scope <> v_into.scope THEN RAISE EXCEPTION 'those relationships are different kinds of conversation'; END IF;

  UPDATE public.journey_sources SET relationship_id = p_into WHERE user_id = v_uid AND relationship_id = p_from;
  UPDATE public.journey_observations SET relationship_id = p_into WHERE user_id = v_uid AND relationship_id = p_from;
  UPDATE public.journey_reflections SET relationship_id = p_into WHERE user_id = v_uid AND relationship_id = p_from;
  DELETE FROM public.journey_summaries WHERE user_id = v_uid AND relationship_id = p_from;
  UPDATE public.journey_relationships SET is_confirmed = true WHERE id = p_into AND user_id = v_uid;
  PERFORM public.journey_touch_relationship(v_uid, p_into);
  DELETE FROM public.journey_relationships WHERE id = p_from AND user_id = v_uid;
  RETURN true;
END;
$$;

-- Reflections can be withdrawn without deleting the account.
CREATE OR REPLACE FUNCTION public.journey_set_reflection_excluded(p_reflection_id uuid, p_excluded boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  UPDATE public.journey_reflections
     SET excluded_at = CASE WHEN p_excluded THEN now() ELSE NULL END
   WHERE id = p_reflection_id AND user_id = v_uid;
  RETURN FOUND;
END;
$$;

-- Auto-staging now re-uses the relationship of the same conversation when one is
-- known, and otherwise creates an UNCONFIRMED relationship the person resolves.
CREATE OR REPLACE FUNCTION public.journey_stage_completed_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind text := TG_ARGV[0]; v_rel uuid; v_scope text; v_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'complete' OR NEW.user_id IS NULL OR (TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM 'complete') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.journey_profiles p WHERE p.user_id=NEW.user_id AND p.opted_in_at IS NOT NULL AND p.auto_include_enabled AND p.activation_consent_at IS NOT NULL AND p.consent_version>=2) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.user_id=NEW.user_id AND s.source_kind=v_kind AND s.source_id=NEW.id) THEN RETURN NEW; END IF;
  v_scope := CASE WHEN v_kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;
  v_label := CASE v_kind WHEN 'quick_take' THEN 'Quick Take' WHEN 'deep_read' THEN 'Deep Read' WHEN 'group_read' THEN 'Group Read' ELSE 'Group Roast' END || ' · ' || to_char(coalesce(NEW.created_at,now()), 'DD Mon YYYY');
  INSERT INTO public.journey_relationships(user_id,kind,label,scope,is_confirmed) VALUES(NEW.user_id,'unspecified',v_label,v_scope,false) RETURNING id INTO v_rel;
  INSERT INTO public.journey_sources(user_id,relationship_id,source_kind,source_id,identity_status) VALUES(NEW.user_id,v_rel,v_kind,NEW.id,'pending') ON CONFLICT(user_id,source_kind,source_id) DO NOTHING;
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
    v_label := CASE r.kind WHEN 'quick_take' THEN 'Quick Take' WHEN 'deep_read' THEN 'Deep Read' WHEN 'group_read' THEN 'Group Read' ELSE 'Group Roast' END
               || ' · ' || to_char(r.created_at, 'DD Mon YYYY');
    INSERT INTO public.journey_relationships (user_id, kind, label, scope, is_confirmed)
    VALUES (v_uid, 'unspecified', v_label, v_scope, false) RETURNING id INTO v_rel;
    INSERT INTO public.journey_sources (user_id, relationship_id, source_kind, source_id, identity_status)
    VALUES (v_uid, v_rel, r.kind, r.id, 'pending');
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;
