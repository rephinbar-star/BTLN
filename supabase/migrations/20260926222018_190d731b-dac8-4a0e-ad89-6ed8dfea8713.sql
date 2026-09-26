ALTER TABLE public.journey_jobs ADD COLUMN IF NOT EXISTS evaluation_run_id uuid;
UPDATE public.journey_jobs j SET evaluation_run_id = r.id, input_fingerprint = NULL
FROM public.prompt_test_runs r
WHERE r.eval_scope = true AND r.target_user_id = j.user_id
  AND j.id::text = COALESCE(r.state->'first'->'body'->>'job_id','')
  AND j.user_id IN (SELECT user_id FROM public.evaluation_accounts);