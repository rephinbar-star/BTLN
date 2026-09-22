CREATE OR REPLACE FUNCTION public.journey_source_participants(p_source_kind text, p_source_id uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_out text[] := '{}';
  v_ctx jsonb;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  IF p_source_kind = 'quick_take' THEN
    -- Quick Take currently stores neither raw messages nor verified display names.
    -- Never substitute generic or inferred identities.
    IF NOT EXISTS (SELECT 1 FROM public.decodes WHERE id=p_source_id AND user_id=v_uid AND status='complete') THEN
      RETURN '{}';
    END IF;
  ELSIF p_source_kind = 'deep_read' THEN
    SELECT context_data INTO v_ctx FROM public.analyses WHERE id=p_source_id AND user_id=v_uid AND status='complete';
    IF v_ctx IS NOT NULL THEN
      v_out := array_remove(ARRAY[nullif(trim(v_ctx->>'name1'),''),nullif(trim(v_ctx->>'name2'),'')],NULL);
    END IF;
  ELSIF p_source_kind = 'group_read' THEN
    SELECT result_json INTO v_result FROM public.group_reads WHERE id=p_source_id AND user_id=v_uid AND status='complete';
    IF v_result IS NOT NULL THEN
      SELECT coalesce(array_agg(DISTINCT nullif(trim(coalesce(x->>'display_name',x->>'name',x->>'participant_id')),'')) FILTER (WHERE nullif(trim(coalesce(x->>'display_name',x->>'name',x->>'participant_id')),'') IS NOT NULL),'{}')
      INTO v_out FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_result->'participants')='array' THEN v_result->'participants' ELSE '[]'::jsonb END) x;
    END IF;
  ELSIF p_source_kind = 'group_roast' THEN
    SELECT coalesce((SELECT array_agg(value) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(participant_labels)='array' THEN participant_labels ELSE '[]'::jsonb END) value),'{}')
    INTO v_out FROM public.group_roasts WHERE id=p_source_id AND user_id=v_uid AND status='complete';
  ELSE
    RAISE EXCEPTION 'unsupported source kind';
  END IF;
  RETURN coalesce(v_out,'{}');
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_validate_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_owner uuid; v_rel_owner uuid; v_scope text;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() AND current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION 'journey sources may only be linked by their owner';
  END IF;
  SELECT user_id, scope INTO v_rel_owner, v_scope FROM public.journey_relationships WHERE id=NEW.relationship_id;
  IF v_rel_owner IS NULL OR v_rel_owner<>NEW.user_id THEN RAISE EXCEPTION 'relationship not owned by caller'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.journey_profiles p WHERE p.user_id=NEW.user_id AND p.opted_in_at IS NOT NULL AND p.activation_consent_at IS NOT NULL AND p.consent_version>=2) THEN
    RAISE EXCEPTION 'current Relationship360 activation consent required';
  END IF;
  IF NEW.source_kind='quick_take' THEN SELECT user_id INTO v_owner FROM public.decodes WHERE id=NEW.source_id AND status='complete';
  ELSIF NEW.source_kind='deep_read' THEN SELECT user_id INTO v_owner FROM public.analyses WHERE id=NEW.source_id AND status='complete';
  ELSIF NEW.source_kind='group_read' THEN SELECT user_id INTO v_owner FROM public.group_reads WHERE id=NEW.source_id AND status='complete';
  ELSIF NEW.source_kind='group_roast' THEN SELECT user_id INTO v_owner FROM public.group_roasts WHERE id=NEW.source_id AND status='complete';
  ELSE RAISE EXCEPTION 'unsupported source kind'; END IF;
  IF v_owner IS NULL OR v_owner<>NEW.user_id THEN RAISE EXCEPTION 'source not found or not owned by caller'; END IF;
  IF (NEW.source_kind IN ('quick_take','deep_read') AND v_scope<>'pair') OR (NEW.source_kind IN ('group_read','group_roast') AND v_scope<>'group') THEN
    RAISE EXCEPTION 'source type does not match relationship scope';
  END IF;
  IF TG_OP='INSERT' AND NEW.identity_status='absent' THEN RAISE EXCEPTION 'a conversation you are not part of cannot be included'; END IF;
  IF NEW.identity_status='confirmed' THEN
    IF NEW.subject_participant IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(public.journey_source_participants(NEW.source_kind,NEW.source_id)) p
      WHERE lower(trim(p))=lower(trim(NEW.subject_participant))
    ) THEN RAISE EXCEPTION 'confirmed participant must belong to this conversation'; END IF;
  ELSE NEW.subject_participant:=NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.journey_validate_source() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey_validate_source() TO service_role;

CREATE OR REPLACE FUNCTION public.journey_stage_completed_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_kind text := TG_ARGV[0]; v_rel uuid; v_scope text; v_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'complete' OR NEW.user_id IS NULL OR (TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM 'complete') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.journey_profiles p WHERE p.user_id=NEW.user_id AND p.opted_in_at IS NOT NULL AND p.auto_include_enabled AND p.activation_consent_at IS NOT NULL AND p.consent_version>=2) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.user_id=NEW.user_id AND s.source_kind=v_kind AND s.source_id=NEW.id) THEN RETURN NEW; END IF;
  v_scope := CASE WHEN v_kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;
  v_label := CASE v_kind WHEN 'quick_take' THEN 'Quick Take' WHEN 'deep_read' THEN 'Deep Read' WHEN 'group_read' THEN 'Group Read' ELSE 'Group Roast' END || ' · ' || to_char(coalesce(NEW.created_at,now()), 'DD Mon YYYY');
  INSERT INTO public.journey_relationships(user_id,kind,label,scope) VALUES(NEW.user_id,'unspecified',v_label,v_scope) RETURNING id INTO v_rel;
  INSERT INTO public.journey_sources(user_id,relationship_id,source_kind,source_id,identity_status) VALUES(NEW.user_id,v_rel,v_kind,NEW.id,'pending') ON CONFLICT(user_id,source_kind,source_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.journey_stage_completed_source() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS journey_stage_decode ON public.decodes;
CREATE TRIGGER journey_stage_decode AFTER INSERT OR UPDATE OF status ON public.decodes FOR EACH ROW EXECUTE FUNCTION public.journey_stage_completed_source('quick_take');
DROP TRIGGER IF EXISTS journey_stage_analysis ON public.analyses;
CREATE TRIGGER journey_stage_analysis AFTER INSERT OR UPDATE OF status ON public.analyses FOR EACH ROW EXECUTE FUNCTION public.journey_stage_completed_source('deep_read');
DROP TRIGGER IF EXISTS journey_stage_group_read ON public.group_reads;
CREATE TRIGGER journey_stage_group_read AFTER INSERT OR UPDATE OF status ON public.group_reads FOR EACH ROW EXECUTE FUNCTION public.journey_stage_completed_source('group_read');
DROP TRIGGER IF EXISTS journey_stage_group_roast ON public.group_roasts;
CREATE TRIGGER journey_stage_group_roast AFTER INSERT OR UPDATE OF status ON public.group_roasts FOR EACH ROW EXECUTE FUNCTION public.journey_stage_completed_source('group_roast');