CREATE UNIQUE INDEX IF NOT EXISTS journey_jobs_one_running_idx
  ON public.journey_jobs (user_id, COALESCE(relationship_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'running';

ALTER TABLE public.journey_summaries ADD COLUMN IF NOT EXISTS input_fingerprint text;
