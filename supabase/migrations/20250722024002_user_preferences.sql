-- Fix the verification rate limits table by adding a unique constraint on ip_address
ALTER TABLE public.verification_rate_limits 
ADD CONSTRAINT verification_rate_limits_ip_address_unique UNIQUE (ip_address);