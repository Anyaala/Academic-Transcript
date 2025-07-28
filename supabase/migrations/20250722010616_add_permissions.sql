-- Security Fix 1: Add DELETE policy for transcripts table
CREATE POLICY "Institutions can delete transcripts for their students" 
ON public.transcripts 
FOR DELETE 
USING (EXISTS (
  SELECT 1
  FROM (students
    JOIN institutions ON (institutions.id = students.institution_id))
  WHERE (students.id = transcripts.student_id) AND (institutions.user_id = auth.uid())
));

-- Security Fix 2: Fix overly permissive student creation policy
-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Students can create their own profile" ON public.students;

-- Create a more restrictive policy that only allows users to create their own profile
CREATE POLICY "Students can create their own profile" 
ON public.students 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Security Fix 3: Update database functions to use secure search_path
CREATE OR REPLACE FUNCTION public.get_user_institution_id()
RETURNS UUID 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.institutions WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user_type is set in user metadata
  IF NEW.raw_user_meta_data->>'user_type' = 'institution' THEN
    INSERT INTO public.institutions (user_id, name, email)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'name', ''), 
      NEW.email
    );
  ELSIF NEW.raw_user_meta_data->>'user_type' = 'student' THEN
    -- Check if student with this email already exists
    IF EXISTS (SELECT 1 FROM public.students WHERE email = NEW.email) THEN
      -- Update existing student record with user_id
      UPDATE public.students 
      SET user_id = NEW.id, 
          full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
          updated_at = now()
      WHERE email = NEW.email;
    ELSE
      -- Insert new student record
      INSERT INTO public.students (user_id, full_name, email)
      VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 
        NEW.email
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

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