-- First, let's create security definer functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_institution_id()
RETURNS UUID AS $$
  SELECT id FROM public.institutions WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Institutions can view students in their institution" ON public.students;
DROP POLICY IF EXISTS "Students can create their own profile" ON public.students;
DROP POLICY IF EXISTS "Students can update their own data" ON public.students;
DROP POLICY IF EXISTS "Students can view their own data" ON public.students;

-- Recreate policies using the security definer function
CREATE POLICY "Students can view their own data" 
ON public.students 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Students can update their own data" 
ON public.students 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Students can create their own profile" 
ON public.students 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Institutions can view students in their institution" 
ON public.students 
FOR SELECT 
USING (institution_id = public.get_user_institution_id());

CREATE POLICY "Institutions can create students" 
ON public.students 
FOR INSERT 
WITH CHECK (institution_id = public.get_user_institution_id());