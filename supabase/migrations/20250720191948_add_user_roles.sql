-- Check if trigger exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the trigger to handle new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Manually create profiles for existing users who don't have them
INSERT INTO public.institutions (user_id, name, email)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'name', 'Unknown Institution'),
  email
FROM auth.users 
WHERE raw_user_meta_data->>'user_type' = 'institution'
  AND id NOT IN (SELECT user_id FROM public.institutions);

INSERT INTO public.students (user_id, full_name, email)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', 'Unknown Student'),
  email
FROM auth.users 
WHERE raw_user_meta_data->>'user_type' = 'student'
  AND id NOT IN (SELECT user_id FROM public.students);