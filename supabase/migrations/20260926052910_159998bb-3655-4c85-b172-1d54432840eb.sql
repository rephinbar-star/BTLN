CREATE TABLE public.prompt_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  version text NOT NULL,
  criteria jsonb NOT NULL,
  content_hash text NOT NULL,
  frozen boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mode, version)
);
CREATE TABLE public.prompt_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  name text NOT NULL,
  revision integer NOT NULL,
  origin text NOT NULL DEFAULT 'synthetic' CHECK (origin IN ('synthetic','consented')),
  cases jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mode, name, revision)
);
CREATE TABLE public.prompt_versions_eval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('baseline','candidate')),
  parent_id uuid REFERENCES public.prompt_versions_eval(id),
  label text NOT NULL,
  prompt_text text NOT NULL,
  model text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  rationale text,
  issue_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_test_record boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.prompt_eval_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.prompt_versions_eval(id),
  baseline_id uuid NOT NULL REFERENCES public.prompt_versions_eval(id),
  dataset_id uuid NOT NULL REFERENCES public.prompt_datasets(id),
  rubric_id uuid NOT NULL REFERENCES public.prompt_rubrics(id),
  binding_hash text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed','cancelled')),
  cases_total integer NOT NULL DEFAULT 0,
  calls_made integer NOT NULL DEFAULT 0,
  calls_failed integer NOT NULL DEFAULT 0,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  summary jsonb,
  error_message text,
  started_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX prompt_eval_jobs_one_running ON public.prompt_eval_jobs (binding_hash) WHERE status = 'running';
CREATE TABLE public.prompt_eval_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.prompt_eval_jobs(id) ON DELETE CASCADE,
  case_id text NOT NULL,
  variant text NOT NULL CHECK (variant IN ('baseline','candidate')),
  status text NOT NULL CHECK (status IN ('ok','failed')),
  output jsonb,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  judge jsonb,
  screen_passed boolean,
  disagreement boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 1,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, case_id, variant)
);
CREATE TABLE public.prompt_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.prompt_versions_eval(id),
  job_id uuid NOT NULL REFERENCES public.prompt_eval_jobs(id),
  binding_hash text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  rationale text NOT NULL,
  reviewer_id uuid NOT NULL,
  is_test_record boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.prompt_runtime_selection (
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  mode text NOT NULL,
  version_id uuid NOT NULL REFERENCES public.prompt_versions_eval(id),
  review_id uuid REFERENCES public.prompt_reviews(id),
  binding_hash text,
  previous_version_id uuid REFERENCES public.prompt_versions_eval(id),
  selected_by uuid NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment, mode)
);
CREATE TABLE public.prompt_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prompt_rubrics, public.prompt_datasets, public.prompt_versions_eval, public.prompt_eval_jobs,
  public.prompt_eval_results, public.prompt_reviews, public.prompt_runtime_selection, public.prompt_audit_events TO authenticated;
GRANT ALL ON public.prompt_rubrics, public.prompt_datasets, public.prompt_versions_eval, public.prompt_eval_jobs,
  public.prompt_eval_results, public.prompt_reviews, public.prompt_runtime_selection, public.prompt_audit_events TO service_role;

ALTER TABLE public.prompt_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions_eval ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_eval_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_eval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_runtime_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read rubrics" ON public.prompt_rubrics FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operators read datasets" ON public.prompt_datasets FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operators read versions" ON public.prompt_versions_eval FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operators read jobs" ON public.prompt_eval_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operators read results" ON public.prompt_eval_results FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operators read reviews" ON public.prompt_reviews FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operators read selection" ON public.prompt_runtime_selection FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operators read audit" ON public.prompt_audit_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Immutability: prompt/rubric/dataset content and review decisions never change after insert.
CREATE OR REPLACE FUNCTION public.prompt_block_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable; create a new version instead', TG_TABLE_NAME;
END; $$;
CREATE TRIGGER prompt_versions_immutable BEFORE UPDATE ON public.prompt_versions_eval FOR EACH ROW EXECUTE FUNCTION public.prompt_block_mutation();
CREATE TRIGGER prompt_rubrics_immutable BEFORE UPDATE ON public.prompt_rubrics FOR EACH ROW EXECUTE FUNCTION public.prompt_block_mutation();
CREATE TRIGGER prompt_datasets_immutable BEFORE UPDATE ON public.prompt_datasets FOR EACH ROW EXECUTE FUNCTION public.prompt_block_mutation();
CREATE TRIGGER prompt_reviews_immutable BEFORE UPDATE ON public.prompt_reviews FOR EACH ROW EXECUTE FUNCTION public.prompt_block_mutation();
CREATE TRIGGER prompt_audit_immutable BEFORE UPDATE ON public.prompt_audit_events FOR EACH ROW EXECUTE FUNCTION public.prompt_block_mutation();

-- Production promotion is disabled pending explicit owner instruction.
CREATE OR REPLACE FUNCTION public.prompt_block_production() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.environment = 'production' THEN
    RAISE EXCEPTION 'production promotion is disabled pending explicit owner approval';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER prompt_selection_no_production BEFORE INSERT OR UPDATE ON public.prompt_runtime_selection FOR EACH ROW EXECUTE FUNCTION public.prompt_block_production();