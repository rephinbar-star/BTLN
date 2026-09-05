DROP POLICY IF EXISTS "Anyone can upload to analysis-uploads" ON storage.objects;

CREATE POLICY "Scoped uploads to analysis-uploads"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'analysis-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.analyses a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.created_at > now() - interval '60 minutes'
      AND (
        a.user_id IS NULL
        OR (auth.uid() IS NOT NULL AND a.user_id = auth.uid())
      )
  )
);