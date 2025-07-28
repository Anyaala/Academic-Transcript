-- Allow public users to search institutions during student signup
-- This is needed for the student signup process to validate institution names

-- Add a policy that allows public/authenticated users to read institution basic info for search
CREATE POLICY "Allow institution search for signup" 
ON public.institutions 
FOR SELECT 
TO authenticated, anon
USING (true);
