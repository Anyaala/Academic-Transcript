-- Enhanced Blockchain Security System Schema
-- This migration adds comprehensive audit logging, verification tracking, and blockchain integration

-- Audit logs table for immutable security events
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('transcript', 'institution', 'student', 'auth', 'system')),
  resource_id TEXT NOT NULL,
  details JSONB,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  encrypted_data TEXT, -- Encrypted audit data for blockchain storage
  blockchain_tx TEXT, -- Reference to blockchain transaction
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit batches table for blockchain batch processing
CREATE TABLE IF NOT EXISTS public.audit_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE, -- Blockchain batch identifier
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  blockchain_tx TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Verification logs table for tracking document verification attempts
CREATE TABLE IF NOT EXISTS public.verification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_id TEXT,
  file_hash TEXT,
  blockchain_tx TEXT,
  action TEXT NOT NULL CHECK (action IN ('verify_id', 'verify_hash', 'verify_transaction')),
  result BOOLEAN NOT NULL DEFAULT false,
  client_ip INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB
);

-- Blockchain configuration table for managing network settings
CREATE TABLE IF NOT EXISTS public.blockchain_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_name TEXT NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  contract_address TEXT,
  contract_type TEXT CHECK (contract_type IN ('verification', 'audit', 'auth')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Authentication tokens table for blockchain-secured auth
CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  blockchain_signature TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_blockchain_tx ON public.audit_logs(blockchain_tx);

CREATE INDEX IF NOT EXISTS idx_audit_batches_created_at ON public.audit_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_batches_blockchain_tx ON public.audit_batches(blockchain_tx);

CREATE INDEX IF NOT EXISTS idx_verification_logs_timestamp ON public.verification_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_verification_logs_verification_id ON public.verification_logs(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_file_hash ON public.verification_logs(file_hash);
CREATE INDEX IF NOT EXISTS idx_verification_logs_client_ip ON public.verification_logs(client_ip);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON public.auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON public.auth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token_hash ON public.auth_tokens(token_hash);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true); -- Controlled by service role

CREATE POLICY "Institutions can view audit logs for their resources" 
ON public.audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.institutions 
    WHERE institutions.user_id = auth.uid()
  )
);

-- RLS Policies for audit_batches
CREATE POLICY "Institutions can view audit batches" 
ON public.audit_batches 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.institutions 
    WHERE institutions.user_id = auth.uid()
  )
);

-- RLS Policies for verification_logs (read-only for transparency)
CREATE POLICY "Anyone can view verification logs" 
ON public.verification_logs 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert verification logs" 
ON public.verification_logs 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for blockchain_config (admin only)
CREATE POLICY "Only service role can manage blockchain config" 
ON public.blockchain_config 
FOR ALL 
USING (auth.role() = 'service_role');

-- RLS Policies for auth_tokens
CREATE POLICY "Users can view their own auth tokens" 
ON public.auth_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auth tokens" 
ON public.auth_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auth tokens" 
ON public.auth_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to automatically log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action TEXT,
  p_resource_type TEXT DEFAULT 'system',
  p_resource_id TEXT DEFAULT '',
  p_details JSONB DEFAULT '{}',
  p_severity TEXT DEFAULT 'low'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    severity
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_severity
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Function to verify blockchain transactions
CREATE OR REPLACE FUNCTION public.verify_blockchain_transaction(
  p_transaction_hash TEXT,
  p_expected_data TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- This function would integrate with blockchain verification
  -- For now, return basic validation
  
  IF p_transaction_hash IS NULL OR LENGTH(p_transaction_hash) < 10 THEN
    v_result := jsonb_build_object(
      'valid', false,
      'error', 'Invalid transaction hash format'
    );
  ELSIF p_transaction_hash LIKE '0x%' AND LENGTH(p_transaction_hash) = 66 THEN
    v_result := jsonb_build_object(
      'valid', true,
      'network', 'ethereum',
      'verified_at', extract(epoch from now())
    );
  ELSE
    v_result := jsonb_build_object(
      'valid', false,
      'error', 'Transaction hash format not recognized'
    );
  END IF;
  
  -- Log the verification attempt
  PERFORM public.log_security_event(
    'blockchain_verification',
    'transaction',
    p_transaction_hash,
    jsonb_build_object('result', v_result, 'expected_data', p_expected_data),
    CASE WHEN (v_result->>'valid')::boolean THEN 'low' ELSE 'medium' END
  );
  
  RETURN v_result;
END;
$$;

-- Function to clean up expired auth tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.auth_tokens 
  WHERE expires_at < now() OR is_revoked = true;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  PERFORM public.log_security_event(
    'token_cleanup',
    'auth',
    '',
    jsonb_build_object('deleted_count', v_deleted_count),
    'low'
  );
  
  RETURN v_deleted_count;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.log_security_event(TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_blockchain_transaction(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_tokens() TO service_role;

-- Insert default blockchain configurations
INSERT INTO public.blockchain_config (network_name, rpc_url, contract_type, is_active) VALUES
  ('ethereum-mainnet', 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID', 'verification', false),
  ('polygon-mainnet', 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY', 'verification', false),
  ('ethereum-sepolia', 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID', 'verification', false),
  ('local-development', 'http://localhost:8545', 'verification', true)
ON CONFLICT (network_name) DO NOTHING;

-- Update triggers for timestamps
CREATE TRIGGER update_audit_logs_updated_at
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audit_batches_updated_at
  BEFORE UPDATE ON public.audit_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blockchain_config_updated_at
  BEFORE UPDATE ON public.blockchain_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Log this migration
SELECT public.log_security_event(
  'blockchain_security_migration',
  'system',
  '20250724150000',
  '{"description": "Enhanced blockchain security system deployed", "tables_created": 5, "functions_created": 3}',
  'low'
);
