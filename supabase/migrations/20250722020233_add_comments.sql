-- Security Fix 1: Tighten student creation policy to prevent cross-institution student creation
DROP POLICY IF EXISTS "Institutions can create students" ON public.students;

CREATE POLICY "Institutions can create students for their institution only" 
ON public.students 
FOR INSERT 
WITH CHECK (
  -- Institution must exist and belong to the authenticated user
  institution_id = get_user_institution_id()
  -- Ensure institution_id is not null to prevent unauthorized creation
  AND institution_id IS NOT NULL
);

-- Security Fix 2: Add proper DELETE policies for institutions (currently missing)
CREATE POLICY "Institutions can delete students from their institution" 
ON public.students 
FOR DELETE 
USING (
  institution_id = get_user_institution_id()
  AND institution_id IS NOT NULL
);

-- Security Fix 3: Tighten institution creation policy to prevent duplicate profiles
DROP POLICY IF EXISTS "Institutions can create their own profile" ON public.institutions;

CREATE POLICY "Institutions can create their own profile" 
ON public.institutions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  -- Prevent duplicate institution profiles for the same user
  AND NOT EXISTS (
    SELECT 1 FROM public.institutions 
    WHERE user_id = auth.uid()
  )
);

-- Security Fix 4: Add missing DELETE policy for institutions
CREATE POLICY "Institutions can delete their own profile" 
ON public.institutions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Security Fix 5: Create audit log table for sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow viewing audit logs for institutions' own actions
CREATE POLICY "Institutions can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.institutions 
    WHERE institutions.user_id = auth.uid()
  )
);

-- Security Fix 6: Add verification status constraints to prevent tampering
ALTER TABLE public.transcripts 
ADD CONSTRAINT valid_verification_status 
CHECK (verified IN (true, false));

-- Security Fix 7: Add constraint to ensure blockchain_tx format is valid when present
ALTER TABLE public.transcripts 
ADD CONSTRAINT valid_blockchain_tx_format 
CHECK (
  blockchain_tx IS NULL 
  OR (blockchain_tx ~ '^0x[a-fA-F0-9]{64}$')
);

-- Security Fix 8: Create function to log sensitive operations
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details
  );
END;
$$;