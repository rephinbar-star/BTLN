-- Create public-read bucket for couple type illustrations
INSERT INTO storage.buckets (id, name, public)
VALUES ('couple_types', 'couple_types', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for assets in this bucket
CREATE POLICY "Couple type illustrations are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'couple_types');

-- INSERT/UPDATE/DELETE intentionally restricted: no policies for anon/authenticated.
-- Only service_role (which bypasses RLS) can write.