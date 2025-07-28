-- Update storage policies to be more secure and user-specific
DROP POLICY IF EXISTS "Authenticated users can upload transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view transcripts they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Institutions can update transcript files" ON storage.objects;
DROP POLICY IF EXISTS "Institutions can delete transcript files" ON storage.objects;

-- Create more secure policies for transcript storage
CREATE POLICY "Institutions can upload transcripts for their students" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'transcripts' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM institutions 
    WHERE institutions.user_id = auth.uid()
  )
);

CREATE POLICY "Students can view their own transcripts" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'transcripts' 
  AND auth.role() = 'authenticated'
  AND (
    -- Students can view their own files (files should be organized by student ID in folders)
    EXISTS (
      SELECT 1 FROM students 
      WHERE students.user_id = auth.uid() 
      AND name LIKE students.id::text || '/%'
    )
    OR
    -- Institutions can view files for their students
    EXISTS (
      SELECT 1 FROM students 
      JOIN institutions ON institutions.id = students.institution_id
      WHERE institutions.user_id = auth.uid()
      AND name LIKE students.id::text || '/%'
    )
  )
);

CREATE POLICY "Institutions can update transcripts for their students" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'transcripts' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM students 
    JOIN institutions ON institutions.id = students.institution_id
    WHERE institutions.user_id = auth.uid()
    AND name LIKE students.id::text || '/%'
  )
);

CREATE POLICY "Institutions can delete transcripts for their students" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'transcripts' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM students 
    JOIN institutions ON institutions.id = students.institution_id
    WHERE institutions.user_id = auth.uid()
    AND name LIKE students.id::text || '/%'
  )
);

-- Fix the database function search path security issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;