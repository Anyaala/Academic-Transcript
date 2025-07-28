-- Clear existing rate limit data and reset the table
TRUNCATE TABLE public.verification_rate_limits;

-- Ensure the unique constraint exists and is properly named
DROP INDEX IF EXISTS verification_rate_limits_ip_address_unique;
ALTER TABLE public.verification_rate_limits 
DROP CONSTRAINT IF EXISTS verification_rate_limits_ip_address_unique;

-- Add the unique constraint back
ALTER TABLE public.verification_rate_limits 
ADD CONSTRAINT verification_rate_limits_ip_address_key UNIQUE (ip_address);