-- Fix student linking issues

-- Update the handle_new_user function to be more robust
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
      COALESCE(NEW.raw_user_meta_data->>'name', 'Unnamed Institution'), 
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
      WHERE email = NEW.email AND user_id IS NULL; -- Only update if not already linked
    ELSE
      -- Insert new student record
      INSERT INTO public.students (user_id, full_name, email)
      VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unnamed Student'), 
        NEW.email
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a function for manual student linking (for fallback cases)
CREATE OR REPLACE FUNCTION public.link_student_to_user(
  p_student_email TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update student record with user_id if it exists and is not already linked
  UPDATE public.students 
  SET user_id = p_user_id, 
      updated_at = now()
  WHERE email = p_student_email 
    AND user_id IS NULL;
    
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Return true if we updated a record
  RETURN v_updated_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.link_student_to_user(TEXT, UUID) TO authenticated;

-- Ensure RLS policy allows updates for user linking
DROP POLICY IF EXISTS "Students can be linked to auth users" ON public.students;
CREATE POLICY "Students can be linked to auth users" 
ON public.students 
FOR UPDATE 
USING (
  -- Allow updates when linking a user_id (from null to a value)
  user_id IS NULL OR auth.uid() = user_id
);
