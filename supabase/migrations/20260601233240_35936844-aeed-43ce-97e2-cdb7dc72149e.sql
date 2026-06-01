-- Add image URL columns to couple_types
ALTER TABLE public.couple_types
  ADD COLUMN IF NOT EXISTS image_url_romantic text,
  ADD COLUMN IF NOT EXISTS image_url_friend text,
  ADD COLUMN IF NOT EXISTS image_url_family text;

-- Configure bucket: 2MB limit, image MIME types only
UPDATE storage.buckets
   SET file_size_limit = 2097152,
       allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
 WHERE id = 'couple_types';

-- Authenticated write policies (public read already exists)
CREATE POLICY "Authenticated can upload couple type images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'couple_types');

CREATE POLICY "Authenticated can update couple type images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'couple_types');

CREATE POLICY "Authenticated can delete couple type images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'couple_types');
