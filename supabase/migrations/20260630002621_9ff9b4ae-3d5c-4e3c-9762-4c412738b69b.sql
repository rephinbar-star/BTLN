DROP POLICY IF EXISTS "Anyone can submit general feedback" ON public.general_feedback;

CREATE POLICY "Anyone can submit general feedback"
ON public.general_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (
  text IS NOT NULL
  AND length(trim(text)) BETWEEN 1 AND 5000
  AND (score IS NULL OR (score BETWEEN 1 AND 10))
  AND (email IS NULL OR length(email) <= 320)
  AND (source IS NULL OR length(source) <= 100)
  AND (question_variant IS NULL OR length(question_variant) <= 50)
);