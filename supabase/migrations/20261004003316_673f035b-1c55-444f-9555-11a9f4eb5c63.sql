ALTER TABLE public.journey_jobs DROP CONSTRAINT journey_jobs_kind_check;
ALTER TABLE public.journey_jobs ADD CONSTRAINT journey_jobs_kind_check
  CHECK (kind = ANY (ARRAY['relationship_synthesis'::text, 'cross_relationship_synthesis'::text, 'monthly_review'::text, 'question_answer'::text]));
CREATE INDEX IF NOT EXISTS journey_jobs_question_usage_idx ON public.journey_jobs (user_id, created_at DESC) WHERE kind = 'question_answer';
INSERT INTO public.prompt_stage_plan (function_name, stage, max_calls_per_run) VALUES ('relationship360', 'ask', 1)
  ON CONFLICT DO NOTHING;