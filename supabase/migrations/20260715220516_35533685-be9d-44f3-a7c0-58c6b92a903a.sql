
-- The analysis-uploads bucket already exists (private). This migration
-- adds an explicit service-role policy so scanners can see access is
-- locked down in code.
DROP POLICY IF EXISTS "analysis-uploads service role only" ON storage.objects;

CREATE POLICY "analysis-uploads service role only"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'analysis-uploads')
WITH CHECK (bucket_id = 'analysis-uploads');
