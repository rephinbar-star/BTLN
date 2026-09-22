ALTER TABLE public.journey_jobs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.journey_jobs DROP CONSTRAINT IF EXISTS journey_jobs_attempt_count_check;
ALTER TABLE public.journey_jobs ADD CONSTRAINT journey_jobs_attempt_count_check CHECK (attempt_count BETWEEN 0 AND 2);
CREATE UNIQUE INDEX IF NOT EXISTS journey_jobs_idempotency_idx
  ON public.journey_jobs(user_id, kind, coalesce(relationship_id, '00000000-0000-0000-0000-000000000000'::uuid), input_fingerprint)
  WHERE input_fingerprint IS NOT NULL AND status IN ('pending','running','complete');

ALTER TABLE public.group_roasts ADD COLUMN IF NOT EXISTS humor_intensity text NOT NULL DEFAULT 'playful';
ALTER TABLE public.group_roasts DROP CONSTRAINT IF EXISTS group_roasts_humor_intensity_check;
ALTER TABLE public.group_roasts ADD CONSTRAINT group_roasts_humor_intensity_check CHECK (humor_intensity IN ('playful','spicy'));