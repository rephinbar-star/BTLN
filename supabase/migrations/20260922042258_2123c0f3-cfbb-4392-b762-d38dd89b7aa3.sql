REVOKE ALL ON public.extraction_budget FROM anon, authenticated;

CREATE POLICY "extraction_budget_no_client_access"
ON public.extraction_budget
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);