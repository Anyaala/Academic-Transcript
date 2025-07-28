-- Update the handle_new_user function to handle existing student records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$