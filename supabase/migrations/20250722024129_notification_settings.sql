-- Drop and recreate the rate limiting function with proper constraint handling
DROP FUNCTION IF EXISTS public.check_verification_rate_limit(inet, text);

CREATE OR REPLACE FUNCTION public.check_verification_rate_limit(p_ip_address inet, p_verification_id text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        -- Block IP for 1 hour - use INSERT with ON CONFLICT handling
        INSERT INTO verification_rate_limits (ip_address, verification_id, blocked_until, attempt_count, last_attempt_at)
        VALUES (p_ip_address, p_verification_id, now() + INTERVAL '1 hour', 1, now())
        ON CONFLICT (ip_address) DO UPDATE SET
            blocked_until = now() + INTERVAL '1 hour',
            last_attempt_at = now(),
            attempt_count = verification_rate_limits.attempt_count + 1;
        RETURN FALSE;
    END IF;
    
    -- Log this attempt - use INSERT with ON CONFLICT handling
    INSERT INTO verification_rate_limits (ip_address, verification_id, attempt_count, last_attempt_at)
    VALUES (p_ip_address, p_verification_id, 1, now())
    ON CONFLICT (ip_address) DO UPDATE SET
        attempt_count = verification_rate_limits.attempt_count + 1,
        last_attempt_at = now(),
        verification_id = COALESCE(p_verification_id, verification_rate_limits.verification_id);
    
    RETURN TRUE; -- Allow the request
END;
$function$