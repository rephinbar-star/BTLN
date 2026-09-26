CREATE TABLE public.journey_summary_quarantine (
  id uuid PRIMARY KEY,
  original jsonb NOT NULL,
  reason text NOT NULL,
  quarantined_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.journey_summary_quarantine TO service_role;
ALTER TABLE public.journey_summary_quarantine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to quarantined summaries" ON public.journey_summary_quarantine FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.journey_block_eval_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.journey_sources s
    WHERE s.id = ANY(COALESCE(NEW.evidence_source_ids, '{}'::uuid[]))
      AND (s.evaluation_run_id IS NOT NULL OR s.quarantined_at IS NOT NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.evaluation_artifacts a
    WHERE a.source_id = ANY(COALESCE(NEW.evidence_source_ids, '{}'::uuid[]))
  ) THEN
    RAISE EXCEPTION 'summary_uses_evaluation_or_quarantined_source';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.journey_block_eval_summary() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER journey_summaries_block_eval BEFORE INSERT OR UPDATE ON public.journey_summaries
FOR EACH ROW EXECUTE FUNCTION public.journey_block_eval_summary();

WITH bad AS (
  SELECT js.* FROM public.journey_summaries js
  WHERE js.user_id IN (SELECT user_id FROM public.evaluation_accounts)
    AND (js.id = '79b4e4fd-ad46-488b-9b08-a20c6388fe00'
      OR EXISTS (SELECT 1 FROM public.journey_sources s WHERE s.id = ANY(COALESCE(js.evidence_source_ids,'{}'::uuid[])) AND (s.evaluation_run_id IS NOT NULL OR s.quarantined_at IS NOT NULL))
      OR COALESCE(js.coverage->>'evaluation_scope','') <> '')
), moved AS (
  INSERT INTO public.journey_summary_quarantine (id, original, reason)
  SELECT id, to_jsonb(bad), 'synthetic_test_build_segregated_2026_09_26' FROM bad
  ON CONFLICT (id) DO NOTHING RETURNING id
)
DELETE FROM public.journey_summaries WHERE id IN (SELECT id FROM moved);