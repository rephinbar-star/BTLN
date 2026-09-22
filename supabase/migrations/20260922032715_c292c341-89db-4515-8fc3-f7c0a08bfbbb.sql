ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_tier_check;
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_tier_check
  CHECK (tier IN ('monthly','annual','lifetime','decode_monthly','interactive_addon','prime','unknown'));

CREATE TABLE public.subscription_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entitlement text NOT NULL CHECK (entitlement IN ('quick_take','interactive_mode','full_reports','relationship360','prime')),
  status text NOT NULL CHECK (status IN ('active','trialing','past_due','canceled','expired','incomplete','unpaid')),
  provider text NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe','legacy','test_fixture')),
  provider_subscription_id text,
  parent_provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entitlement, provider, provider_subscription_id)
);
GRANT SELECT ON public.subscription_entitlements TO authenticated;
GRANT ALL ON public.subscription_entitlements TO service_role;
ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view subscription entitlements" ON public.subscription_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER subscription_entitlements_updated_at BEFORE UPDATE ON public.subscription_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.interactive_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  decode_id uuid NOT NULL REFERENCES public.decodes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','deleted')),
  context_version integer NOT NULL DEFAULT 1,
  structured_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, decode_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactive_threads TO authenticated;
GRANT ALL ON public.interactive_threads TO service_role;
ALTER TABLE public.interactive_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage interactive threads" ON public.interactive_threads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER interactive_threads_updated_at BEFORE UPDATE ON public.interactive_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.interactive_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.interactive_threads(id) ON DELETE CASCADE,
  client_request_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent_reply','no_reply','chose_not_to_reply','observed_followup','self_report')),
  input_method text NOT NULL CHECK (input_method IN ('text','screenshot','none')),
  speaker_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','extracting','analyzing','complete','failed','cancelled')),
  result_json jsonb,
  error_message text,
  usage_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  started_from_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_request_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactive_events TO authenticated;
GRANT ALL ON public.interactive_events TO service_role;
ALTER TABLE public.interactive_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage interactive events" ON public.interactive_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX interactive_events_thread_idx ON public.interactive_events(thread_id, created_at);
CREATE TRIGGER interactive_events_updated_at BEFORE UPDATE ON public.interactive_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  relationship_id uuid REFERENCES public.journey_relationships(id) ON DELETE CASCADE,
  journey_summary_id uuid REFERENCES public.journey_summaries(id) ON DELETE SET NULL,
  recommendation_id text,
  reflection_kind text NOT NULL CHECK (reflection_kind IN ('reflection','action_outcome','review_note')),
  response_text text NOT NULL CHECK (char_length(response_text) BETWEEN 1 AND 2000),
  outcome text CHECK (outcome IS NULL OR outcome IN ('used','partly_used','not_used','not_applicable')),
  self_reported_at timestamptz NOT NULL DEFAULT now(),
  excluded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_reflections TO authenticated;
GRANT ALL ON public.journey_reflections TO service_role;
ALTER TABLE public.journey_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage private journey reflections" ON public.journey_reflections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX journey_reflections_user_idx ON public.journey_reflections(user_id, self_reported_at DESC);
CREATE TRIGGER journey_reflections_updated_at BEFORE UPDATE ON public.journey_reflections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_entitlement(p_entitlement text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.subscription_entitlements e
    WHERE e.user_id = auth.uid()
      AND e.entitlement IN (p_entitlement, 'prime')
      AND e.status IN ('active','trialing','past_due')
      AND (e.current_period_end IS NULL OR e.current_period_end > now())
  );
$$;
REVOKE ALL ON FUNCTION public.has_entitlement(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_entitlement(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.journey_source_participants(p_source_kind text, p_source_id uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_out text[] := '{}';
  v_ctx jsonb;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  IF p_source_kind = 'quick_take' THEN
    IF EXISTS (SELECT 1 FROM public.decodes WHERE id=p_source_id AND user_id=v_uid AND status='complete') THEN
      v_out := ARRAY['You','Them'];
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

CREATE OR REPLACE FUNCTION public.journey_confirm_identity(p_source_id uuid, p_participant text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_source public.journey_sources%ROWTYPE;
  v_allowed text[];
  v_match text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO v_source FROM public.journey_sources WHERE id=p_source_id AND user_id=v_uid;
  IF v_source.id IS NULL THEN RETURN false; END IF;
  v_allowed := public.journey_source_participants(v_source.source_kind,v_source.source_id);
  SELECT candidate INTO v_match FROM unnest(v_allowed) candidate
    WHERE lower(trim(candidate))=lower(trim(p_participant)) LIMIT 1;
  IF v_match IS NULL THEN RAISE EXCEPTION 'choose a participant from this conversation'; END IF;
  UPDATE public.journey_sources SET subject_participant=v_match, identity_status='confirmed', excluded_at=NULL
    WHERE id=p_source_id AND user_id=v_uid;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_validate_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_owner uuid; v_rel_owner uuid;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() AND current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION 'journey sources may only be linked by their owner';
  END IF;
  SELECT user_id INTO v_rel_owner FROM public.journey_relationships WHERE id=NEW.relationship_id;
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

CREATE OR REPLACE FUNCTION public.journey_set_source_excluded(p_source_id uuid, p_excluded boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  UPDATE public.journey_sources
    SET excluded_at=CASE WHEN p_excluded THEN now() ELSE NULL END
    WHERE id=p_source_id AND user_id=auth.uid()
      AND (p_excluded OR identity_status='confirmed');
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.journey_opt_out()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  UPDATE public.journey_profiles SET opted_in_at=NULL, auto_include_enabled=false WHERE user_id=auth.uid();
  UPDATE public.journey_jobs SET status='cancelled', updated_at=now()
    WHERE user_id=auth.uid() AND status IN ('pending','running');
END; $$;

CREATE OR REPLACE FUNCTION public.journey_export()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'exported_at',now(),
    'profile',(SELECT to_jsonb(p) FROM public.journey_profiles p WHERE p.user_id=auth.uid()),
    'relationships',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.journey_relationships r WHERE r.user_id=auth.uid()),'[]'::jsonb),
    'sources',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.journey_sources s WHERE s.user_id=auth.uid()),'[]'::jsonb),
    'observations',coalesce((SELECT jsonb_agg(to_jsonb(o)) FROM public.journey_observations o WHERE o.user_id=auth.uid()),'[]'::jsonb),
    'summaries',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.journey_summaries s WHERE s.user_id=auth.uid()),'[]'::jsonb),
    'reflections',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.journey_reflections r WHERE r.user_id=auth.uid()),'[]'::jsonb)
  ) WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.journey_validate_source() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey_validate_source() TO service_role;
REVOKE ALL ON FUNCTION public.journey_source_participants(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_source_participants(text,uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.journey_confirm_identity(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_confirm_identity(uuid,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.journey_set_source_excluded(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_set_source_excluded(uuid,boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.journey_opt_out() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_opt_out() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.journey_export() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_export() TO authenticated, service_role;