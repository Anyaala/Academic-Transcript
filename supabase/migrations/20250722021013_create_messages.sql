-- Critical Security Fix: Add missing check constraints that failed to apply
-- Check if constraints exist first, then add them
DO $$ 
BEGIN
    -- Add verification status constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_verification_status' 
        AND table_name = 'transcripts'
    ) THEN
        ALTER TABLE public.transcripts 
        ADD CONSTRAINT valid_verification_status 
        CHECK (verified IN (true, false));
    END IF;

    -- Add blockchain_tx format constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_blockchain_tx_format' 
        AND table_name = 'transcripts'
    ) THEN
        ALTER TABLE public.transcripts 
        ADD CONSTRAINT valid_blockchain_tx_format 
        CHECK (
            blockchain_tx IS NULL 
            OR (blockchain_tx ~ '^0x[a-fA-F0-9]{64}$')
        );
    END IF;
END $$;

-- Security Fix: Add INSERT policy for audit logs (currently missing)
DROP POLICY IF EXISTS "Allow logging audit events" ON public.audit_logs;
CREATE POLICY "Allow logging audit events" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (
    -- Only allow authenticated users to log events
    auth.uid() IS NOT NULL
    -- And the user_id matches the authenticated user or is being set by a security definer function
    AND (user_id = auth.uid() OR user_id IS NULL)
);

-- Security Fix: Add rate limiting table for verification attempts
CREATE TABLE IF NOT EXISTS public.verification_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    verification_id TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on rate limiting table
ALTER TABLE public.verification_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow read access for rate limiting checks (public verification page)
CREATE POLICY "Allow rate limit checks" 
ON public.verification_rate_limits 
FOR SELECT 
USING (true);

-- Allow insert for new rate limit entries
CREATE POLICY "Allow rate limit logging" 
ON public.verification_rate_limits 
FOR INSERT 
WITH CHECK (true);

-- Allow update for incrementing attempt counts
CREATE POLICY "Allow rate limit updates" 
ON public.verification_rate_limits 
FOR UPDATE 
USING (true);

-- Security Fix: Add function to check and enforce rate limits
CREATE OR REPLACE FUNCTION public.check_verification_rate_limit(
    p_ip_address INET,
    p_verification_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_attempts INTEGER := 0;
    blocked_until_time TIMESTAMP WITH TIME ZONE;
    window_start TIMESTAMP WITH TIME ZONE := now() - INTERVAL '1 hour';
BEGIN
    -- Check if IP is currently blocked
    SELECT blocked_until INTO blocked_until_time
    FROM verification_rate_limits
    WHERE ip_address = p_ip_address
    AND blocked_until > now()
    LIMIT 1;
    
    IF blocked_until_time IS NOT NULL THEN
        RETURN FALSE; -- IP is blocked
    END IF;
    
    -- Count recent attempts from this IP
    SELECT COALESCE(SUM(attempt_count), 0) INTO current_attempts
    FROM verification_rate_limits
    WHERE ip_address = p_ip_address
    AND last_attempt_at > window_start;
    
    -- Allow up to 20 attempts per hour
    IF current_attempts >= 20 THEN
        -- Block IP for 1 hour
        INSERT INTO verification_rate_limits (ip_address, verification_id, blocked_until)
        VALUES (p_ip_address, p_verification_id, now() + INTERVAL '1 hour')
        ON CONFLICT (ip_address) DO UPDATE SET
            blocked_until = now() + INTERVAL '1 hour',
            last_attempt_at = now();
        RETURN FALSE;
    END IF;
    
    -- Log this attempt
    INSERT INTO verification_rate_limits (ip_address, verification_id)
    VALUES (p_ip_address, p_verification_id)
    ON CONFLICT (ip_address) DO UPDATE SET
        attempt_count = verification_rate_limits.attempt_count + 1,
        last_attempt_at = now();
    
    RETURN TRUE; -- Allow the request
END;
$$;