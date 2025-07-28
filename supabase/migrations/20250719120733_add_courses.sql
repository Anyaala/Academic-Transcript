-- Fix RLS policies for signup process
-- The issue is that during signup, the user session might not be fully established
-- when trying to create the profile, causing RLS policy violations

-- First, let's update the institutions table policies to handle signup better
DROP POLICY IF EXISTS "Institutions can create their own profile" ON public.institutions;

-- Create a more permissive policy for profile creation during signup
CREATE POLICY "Institutions can create their own profile" 
ON public.institutions 
FOR INSERT 
WITH CHECK (
  -- Allow if the user_id matches the authenticated user
  auth.uid() = user_id
  -- OR if this is during the signup process (user exists in auth.users but no profile yet)
  OR (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.institutions 
      WHERE institutions.user_id = auth.uid()
    )
  )
);

-- Do the same for students table
DROP POLICY IF EXISTS "Students can create their own profile" ON public.students;

CREATE POLICY "Students can create their own profile" 
ON public.students 
FOR INSERT 
WITH CHECK (
  -- Allow if the user_id matches the authenticated user
  auth.uid() = user_id
  -- OR if this is during the signup process (user exists in auth.users but no profile yet)
  OR (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.students 
      WHERE students.user_id = auth.uid()
    )
  )
);

-- Alternative approach: Create a trigger-based solution for automatic profile creation
-- This is more secure as it doesn't rely on client-side profile creation

-- Function to handle new user profile creation
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
    INSERT INTO public.students (user_id, full_name, email)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 
      NEW.email
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profiles when users sign up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();