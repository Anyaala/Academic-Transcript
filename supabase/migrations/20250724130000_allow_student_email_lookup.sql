-- Allow students to look up their own records by email during signup
-- This is needed for the student account setup process

-- Create a secure function for student email lookup during signup
CREATE OR REPLACE FUNCTION public.check_student_for_signup(student_email text)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  institution_id uuid,
  user_id uuid,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.full_name, s.email, s.institution_id, s.user_id, s.created_at
  FROM public.students s
  WHERE s.email = student_email
  LIMIT 1;
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.check_student_for_signup(text) TO anon, authenticated;

-- Also add a simpler RLS policy as backup
CREATE POLICY "Allow student email lookup for signup" 
ON public.students 
FOR SELECT 
TO authenticated, anon
USING (true);
