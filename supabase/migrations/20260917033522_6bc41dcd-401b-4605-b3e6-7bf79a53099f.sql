-- ============ Journey foundation (Stage 1, additive) ============

CREATE TABLE public.journey_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  opted_in_at timestamptz,
  data_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_profiles TO authenticated;
GRANT ALL ON public.journey_profiles TO service_role;
ALTER TABLE public.journey_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own journey profile" ON public.journey_profiles
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER journey_profiles_updated_at BEFORE UPDATE ON public.journey_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('romantic','friend','family','work_group')),
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 80),
  data_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journey_relationships_user_idx ON public.journey_relationships(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_relationships TO authenticated;
GRANT ALL ON public.journey_relationships TO service_role;
ALTER TABLE public.journey_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own relationships" ON public.journey_relationships
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER journey_relationships_updated_at BEFORE UPDATE ON public.journey_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id uuid NOT NULL REFERENCES public.journey_relationships(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('quick_take','deep_read','group_read','group_roast')),
  source_id uuid NOT NULL,
  subject_participant text,
  observed_period_start timestamptz,
  observed_period_end timestamptz,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  consent_at timestamptz NOT NULL DEFAULT now(),
  excluded_at timestamptz,
  adapter_version integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, relationship_id, source_kind, source_id)
);
CREATE INDEX journey_sources_rel_idx ON public.journey_sources(relationship_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_sources TO authenticated;
GRANT ALL ON public.journey_sources TO service_role;
ALTER TABLE public.journey_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own journey sources" ON public.journey_sources
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER journey_sources_updated_at BEFORE UPDATE ON public.journey_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id uuid NOT NULL REFERENCES public.journey_relationships(id) ON DELETE CASCADE,
  journey_source_id uuid NOT NULL REFERENCES public.journey_sources(id) ON DELETE CASCADE,
  subject_kind text NOT NULL CHECK (subject_kind IN ('user_behavior','other_behavior','ai_advice','self_report')),
  subject_label text,
  observation_type text NOT NULL,
  statement text NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 2000),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low','medium','high')),
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_period_start timestamptz,
  observed_period_end timestamptz,
  corrected_at timestamptz,
  excluded_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journey_observations_rel_idx ON public.journey_observations(relationship_id, observed_period_start);
CREATE INDEX journey_observations_source_idx ON public.journey_observations(journey_source_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_observations TO authenticated;
GRANT ALL ON public.journey_observations TO service_role;
ALTER TABLE public.journey_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own observations" ON public.journey_observations
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER journey_observations_updated_at BEFORE UPDATE ON public.journey_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id uuid REFERENCES public.journey_relationships(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('relationship','cross_relationship')),
  content jsonb NOT NULL,
  evidence_source_ids uuid[] NOT NULL DEFAULT '{}',
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  built_from_version integer NOT NULL,
  is_stale boolean NOT NULL DEFAULT false,
  model text,
  usage_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'relationship' AND relationship_id IS NOT NULL)
      OR (scope = 'cross_relationship' AND relationship_id IS NULL))
);
CREATE INDEX journey_summaries_user_idx ON public.journey_summaries(user_id, scope);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_summaries TO authenticated;
GRANT ALL ON public.journey_summaries TO service_role;
ALTER TABLE public.journey_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own summaries" ON public.journey_summaries
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER journey_summaries_updated_at BEFORE UPDATE ON public.journey_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id uuid REFERENCES public.journey_relationships(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('relationship_synthesis','cross_relationship_synthesis','monthly_review')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','cancelled')),
  started_from_version integer NOT NULL,
  input_fingerprint text,
  error_message text,
  usage_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journey_jobs_user_idx ON public.journey_jobs(user_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_jobs TO authenticated;
GRANT ALL ON public.journey_jobs TO service_role;
ALTER TABLE public.journey_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own journey jobs" ON public.journey_jobs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER journey_jobs_updated_at BEFORE UPDATE ON public.journey_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Server-side ownership validation for linked sources ============

CREATE OR REPLACE FUNCTION public.journey_validate_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT user_id INTO v_owner FROM public.roasts WHERE id = NEW.source_id;
  END IF;

  IF v_owner IS NULL OR v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'source not found or not owned by caller';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER journey_sources_validate
  BEFORE INSERT OR UPDATE OF source_id, source_kind, relationship_id, user_id
  ON public.journey_sources
  FOR EACH ROW EXECUTE FUNCTION public.journey_validate_source();

-- ============ Invalidation: any change bumps versions and stales summaries ============

CREATE OR REPLACE FUNCTION public.journey_bump_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_rel uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id; v_rel := OLD.relationship_id;
  ELSE
    v_user := NEW.user_id; v_rel := NEW.relationship_id;
  END IF;

  UPDATE public.journey_relationships
     SET data_version = data_version + 1
   WHERE id = v_rel;

  UPDATE public.journey_profiles
     SET data_version = data_version + 1
   WHERE user_id = v_user;

  UPDATE public.journey_summaries
     SET is_stale = true
   WHERE user_id = v_user
     AND (relationship_id = v_rel OR scope = 'cross_relationship');

  -- Any job started before this change can no longer write.
  UPDATE public.journey_jobs
     SET status = 'cancelled'
   WHERE user_id = v_user
     AND status IN ('pending','running')
     AND (relationship_id = v_rel OR relationship_id IS NULL);

  RETURN NULL;
END;
$$;

CREATE TRIGGER journey_sources_invalidate
  AFTER INSERT OR UPDATE OR DELETE ON public.journey_sources
  FOR EACH ROW EXECUTE FUNCTION public.journey_bump_version();

CREATE TRIGGER journey_observations_invalidate
  AFTER INSERT OR UPDATE OR DELETE ON public.journey_observations
  FOR EACH ROW EXECUTE FUNCTION public.journey_bump_version();

-- ============ Guarded summary write (rejects late jobs) ============

CREATE OR REPLACE FUNCTION public.journey_write_summary(
  p_job_id uuid,
  p_scope text,
  p_relationship_id uuid,
  p_content jsonb,
  p_evidence_source_ids uuid[],
  p_coverage jsonb,
  p_model text,
  p_usage jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.journey_jobs%ROWTYPE;
  v_current integer;
  v_id uuid;
BEGIN
  SELECT * INTO v_job FROM public.journey_jobs WHERE id = p_job_id;
  IF NOT FOUND OR v_job.status = 'cancelled' THEN
    RETURN false;
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_job.user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_scope = 'relationship' THEN
    SELECT data_version INTO v_current FROM public.journey_relationships
      WHERE id = p_relationship_id AND user_id = v_job.user_id;
  ELSE
    SELECT data_version INTO v_current FROM public.journey_profiles
      WHERE user_id = v_job.user_id;
  END IF;

  IF v_current IS NULL OR v_current <> v_job.started_from_version THEN
    UPDATE public.journey_jobs SET status = 'cancelled' WHERE id = p_job_id;
    RETURN false;
  END IF;

  SELECT id INTO v_id FROM public.journey_summaries
   WHERE user_id = v_job.user_id
     AND scope = p_scope
     AND relationship_id IS NOT DISTINCT FROM p_relationship_id
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.journey_summaries (
      user_id, relationship_id, scope, content, evidence_source_ids,
      coverage, built_from_version, is_stale, model, usage_json, generated_at
    ) VALUES (
      v_job.user_id, p_relationship_id, p_scope, p_content,
      COALESCE(p_evidence_source_ids, '{}'), COALESCE(p_coverage, '{}'::jsonb),
      v_current, false, p_model, COALESCE(p_usage, '{}'::jsonb), now()
    );
  ELSE
    UPDATE public.journey_summaries
       SET content = p_content,
           evidence_source_ids = COALESCE(p_evidence_source_ids, '{}'),
           coverage = COALESCE(p_coverage, '{}'::jsonb),
           built_from_version = v_current,
           is_stale = false,
           model = p_model,
           usage_json = COALESCE(p_usage, '{}'::jsonb),
           generated_at = now()
     WHERE id = v_id;
  END IF;

  UPDATE public.journey_jobs SET status = 'complete' WHERE id = p_job_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.journey_write_summary(uuid, text, uuid, jsonb, uuid[], jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_write_summary(uuid, text, uuid, jsonb, uuid[], jsonb, text, jsonb) TO authenticated, service_role;

-- ============ Full journey deletion ============

CREATE OR REPLACE FUNCTION public.journey_delete_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;
  DELETE FROM public.journey_jobs WHERE user_id = auth.uid();
  DELETE FROM public.journey_summaries WHERE user_id = auth.uid();
  DELETE FROM public.journey_observations WHERE user_id = auth.uid();
  DELETE FROM public.journey_sources WHERE user_id = auth.uid();
  DELETE FROM public.journey_relationships WHERE user_id = auth.uid();
  DELETE FROM public.journey_profiles WHERE user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.journey_delete_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_delete_all() TO authenticated;