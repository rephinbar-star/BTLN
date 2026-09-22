ALTER TABLE public.journey_observations DROP CONSTRAINT IF EXISTS journey_observations_subject_kind_check;
ALTER TABLE public.journey_observations ADD CONSTRAINT journey_observations_subject_kind_check
  CHECK (subject_kind = ANY (ARRAY['user_behavior','other_behavior','ai_advice','self_report','relationship_context','generated_interpretation']));
