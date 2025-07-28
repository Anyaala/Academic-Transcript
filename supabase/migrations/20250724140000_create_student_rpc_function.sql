-- Create RPC function for creating/finding students for institution
CREATE OR REPLACE FUNCTION create_student_for_institution(
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  email TEXT,
  institution_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_institution_id UUID;
  v_student_record RECORD;
BEGIN
  -- Get the institution ID for the current user
  SELECT institutions.id INTO v_institution_id
  FROM institutions
  WHERE institutions.user_id = auth.uid();
  
  IF v_institution_id IS NULL THEN
    RAISE EXCEPTION 'Institution not found for current user';
  END IF;
  
  -- Try to find existing student
  SELECT * INTO v_student_record
  FROM students
  WHERE students.email = p_email;
  
  IF v_student_record IS NOT NULL THEN
    -- Check if student belongs to a different institution
    IF v_student_record.institution_id IS NOT NULL AND v_student_record.institution_id != v_institution_id THEN
      RAISE EXCEPTION 'Student belongs to a different institution';
    END IF;
    
    -- Update the student record if it's unlinked or needs institution assignment
    IF v_student_record.institution_id IS NULL THEN
      UPDATE students 
      SET institution_id = v_institution_id,
          full_name = COALESCE(p_full_name, v_student_record.full_name),
          updated_at = now()
      WHERE students.id = v_student_record.id;
    END IF;
    
    -- Return the existing/updated student
    RETURN QUERY
    SELECT s.id, s.full_name, s.email, s.institution_id, s.user_id, s.created_at, s.updated_at
    FROM students s
    WHERE s.id = v_student_record.id;
  ELSE
    -- Create new student record
    INSERT INTO students (full_name, email, institution_id)
    VALUES (COALESCE(p_full_name, split_part(p_email, '@', 1)), p_email, v_institution_id)
    RETURNING * INTO v_student_record;
    
    -- Return the new student
    RETURN QUERY
    SELECT s.id, s.full_name, s.email, s.institution_id, s.user_id, s.created_at, s.updated_at
    FROM students s
    WHERE s.id = v_student_record.id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_student_for_institution(TEXT, TEXT) TO authenticated;
