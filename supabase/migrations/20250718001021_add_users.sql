-- Create storage bucket for transcripts
INSERT INTO storage.buckets (id, name, public) VALUES ('transcripts', 'transcripts', false);

-- Create policies for transcript storage
CREATE POLICY "Authenticated users can upload transcripts" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'transcripts' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view transcripts they have access to" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'transcripts' AND auth.role() = 'authenticated');

CREATE POLICY "Institutions can update transcript files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'transcripts' AND auth.role() = 'authenticated');

CREATE POLICY "Institutions can delete transcript files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'transcripts' AND auth.role() = 'authenticated');