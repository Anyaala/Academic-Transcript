-- Make sure the transcripts bucket is public for downloads
UPDATE storage.buckets SET public = true WHERE id = 'transcripts';

-- Create or update the storage policies for transcripts bucket
-- Delete existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Institutions can upload transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their own transcripts" ON storage.objects;

-- Create new policies
CREATE POLICY "Anyone can view transcripts"
ON storage.objects FOR SELECT
USING (bucket_id = 'transcripts');

CREATE POLICY "Institutions can upload transcripts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'transcripts' AND
  EXISTS (
    SELECT 1 FROM institutions 
    WHERE institutions.user_id = auth.uid()
  )
);

CREATE POLICY "Institutions can delete their uploaded transcripts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'transcripts' AND
  EXISTS (
    SELECT 1 FROM institutions 
    WHERE institutions.user_id = auth.uid()
  )
);