-- Allow students to search for institutions during signup
-- This is needed for the student signup process to validate institution names

-- Create a secure function for searching institutions
-- This allows students to search without giving them full read access to the table
CREATE OR REPLACE FUNCTION public.search_institutions(search_term text)
RETURNS TABLE (
  id uuid,
  name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.email
  FROM public.institutions i
  WHERE i.name ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE 
      WHEN LOWER(i.name) = LOWER(search_term) THEN 1
      WHEN LOWER(i.name) LIKE LOWER(search_term) || '%' THEN 2
      ELSE 3
    END,
    i.name
  LIMIT 10;
END;
$$;

-- Grant execute permission to authenticated users (students)
GRANT EXECUTE ON FUNCTION public.search_institutions(text) TO authenticated;

-- Also create a function for exact institution matching
CREATE OR REPLACE FUNCTION public.find_institution_by_name(institution_name text)
RETURNS TABLE (
  id uuid,
  name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.email
  FROM public.institutions i
  WHERE LOWER(i.name) = LOWER(institution_name)
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_institution_by_name(text) TO authenticated;
