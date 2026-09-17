CREATE TABLE public.group_roasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','analyzing','complete','failed','blocked')),
  participant_count integer NOT NULL CHECK (participant_count BETWEEN 3 AND 15),
  message_count integer NOT NULL CHECK (message_count >= 10 AND message_count <= 12000),
  selected_period jsonb NOT NULL DEFAULT '{}'::jsonb,
  participant_labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  coverage_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_json jsonb,
  result_json jsonb,
  observations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_blocked boolean NOT NULL DEFAULT false,
  error_message text,
  input_fingerprint text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  usage_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, input_fingerprint)
);
GRANT ALL ON public.group_roasts TO service_role;
ALTER TABLE public.group_roasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access to group roasts"
  ON public.group_roasts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX group_roasts_user_created_idx ON public.group_roasts (user_id, created_at DESC);
CREATE INDEX group_roasts_status_idx ON public.group_roasts (status, updated_at);
CREATE TRIGGER update_group_roasts_updated_at
  BEFORE UPDATE ON public.group_roasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.group_roast_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_roast_id uuid NOT NULL REFERENCES public.group_roasts(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL CHECK (amount_cents = 499),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_roast_id)
);
GRANT SELECT ON public.group_roast_unlocks TO authenticated;
GRANT ALL ON public.group_roast_unlocks TO service_role;
ALTER TABLE public.group_roast_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can read group roast unlocks"
  ON public.group_roast_unlocks FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX group_roast_unlocks_target_idx ON public.group_roast_unlocks (group_roast_id);

CREATE TABLE public.group_roast_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_roast_id uuid NOT NULL REFERENCES public.group_roasts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  snapshot_json jsonb NOT NULL,
  include_names boolean NOT NULL DEFAULT false,
  include_quotes boolean NOT NULL DEFAULT false,
  visit_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.group_roast_share_links TO service_role;
ALTER TABLE public.group_roast_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access to group roast shares"
  ON public.group_roast_share_links FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX group_roast_share_target_idx ON public.group_roast_share_links (group_roast_id);
CREATE TRIGGER update_group_roast_share_links_updated_at
  BEFORE UPDATE ON public.group_roast_share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_group_roast_unlock(p_group_roast_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_roast_unlocks
     WHERE group_roast_id = p_group_roast_id
       AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.has_group_roast_unlock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_group_roast_unlock(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_roast_for_owner(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_row public.group_roasts%ROWTYPE;
  v_entitled boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_row FROM public.group_roasts
   WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_entitled := public.has_group_roast_unlock(p_id)
    OR public.user_has_full_plan(auth.uid());
  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'participant_count', v_row.participant_count,
    'message_count', v_row.message_count,
    'selected_period', v_row.selected_period,
    'participant_labels', v_row.participant_labels,
    'stats', v_row.stats_json,
    'coverage', v_row.coverage_json,
    'preview', v_row.preview_json,
    'result', CASE WHEN v_entitled THEN v_row.result_json ELSE NULL END,
    'observations', CASE WHEN v_entitled THEN v_row.observations_json ELSE '[]'::jsonb END,
    'is_unlocked', v_entitled,
    'safety_blocked', v_row.safety_blocked,
    'error_message', v_row.error_message,
    'created_at', v_row.created_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_group_roast_for_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_roast_for_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_roast_share_for_owner(p_group_roast_id uuid)
RETURNS TABLE(id uuid, include_names boolean, include_quotes boolean, revoked_at timestamptz,
              visit_count integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.id, s.include_names, s.include_quotes, s.revoked_at, s.visit_count, s.created_at
    FROM public.group_roast_share_links s
    JOIN public.group_roasts g ON g.id = s.group_roast_id
   WHERE s.group_roast_id = p_group_roast_id
     AND s.revoked_at IS NULL
     AND g.user_id = auth.uid()
   ORDER BY s.created_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_group_roast_share_for_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_roast_share_for_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_group_roast_share(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_snapshot jsonb;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) < 32 THEN RETURN NULL; END IF;
  SELECT id, snapshot_json INTO v_id, v_snapshot
    FROM public.group_roast_share_links
   WHERE token_hash = p_token_hash AND revoked_at IS NULL LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.group_roast_share_links SET visit_count = visit_count + 1 WHERE id = v_id;
  RETURN v_snapshot;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_group_roast_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_group_roast_share(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.journey_validate_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_rel_owner uuid;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'journey sources may only be linked by their owner';
  END IF;
  SELECT user_id INTO v_rel_owner FROM public.journey_relationships WHERE id = NEW.relationship_id;
  IF v_rel_owner IS NULL OR v_rel_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'relationship not owned by caller';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.journey_profiles p
                  WHERE p.user_id = NEW.user_id AND p.opted_in_at IS NOT NULL) THEN
    RAISE EXCEPTION 'journey opt-in required';
  END IF;
  IF NEW.source_kind = 'quick_take' THEN
    SELECT user_id INTO v_owner FROM public.decodes WHERE id = NEW.source_id;
  ELSIF NEW.source_kind = 'deep_read' THEN
    SELECT user_id INTO v_owner FROM public.analyses WHERE id = NEW.source_id;
  ELSIF NEW.source_kind = 'group_read' THEN
    SELECT user_id INTO v_owner FROM public.group_reads WHERE id = NEW.source_id;
  ELSIF NEW.source_kind = 'group_roast' THEN
    SELECT user_id INTO v_owner FROM public.group_roasts WHERE id = NEW.source_id AND status = 'complete';
  END IF;
  IF v_owner IS NULL OR v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'source not found or not owned by caller';
  END IF;
  RETURN NEW;
END;
$$;