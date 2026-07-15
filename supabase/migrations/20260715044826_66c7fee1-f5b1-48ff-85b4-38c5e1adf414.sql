
CREATE POLICY "Anyone can upload to analysis-uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'analysis-uploads');
