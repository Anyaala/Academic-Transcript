import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface BlockchainAuthState {
  isBlockchainEnabled: boolean
  authToken: string | null
  lastVerification: Date | null
  isLoading: boolean
  error: string | null
}

interface AuthEvent {
  action: 'login' | 'logout' | 'signup' | 'password_change' | 'permission_change'
  metadata?: Record<string, any>
}

interface VerificationRequest {
  verificationId?: string
  fileHash?: string
  blockchainTx?: string
  action: 'verify_id' | 'verify_hash' | 'verify_transaction'
}

interface VerificationResult {
  valid: boolean
  timestamp?: number
  blockNumber?: number
  transactionDetails?: any
  documentHash?: string
  institutionAddress?: string
  metadata?: Record<string, any>
}

export function useBlockchainAuth() {
  const [state, setState] = useState<BlockchainAuthState>({
    isBlockchainEnabled: false,
    authToken: null,
    lastVerification: null,
    isLoading: false,
    error: null
  })
  const { toast } = useToast()

  // Check blockchain availability on mount
  useEffect(() => {
    // Since functions are deployed, enable blockchain by default
    // The actual status will be verified when functions are called
    setState(prev => ({
      ...prev,
      isBlockchainEnabled: true,
      isLoading: false,
      error: null
    }))
  }, [])

  const checkBlockchainStatus = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      // Try the simple status endpoint first (if available)
      try {
        const { data, error } = await supabase.functions.invoke('blockchain-status')
        
        if (!error && data?.success) {
          setState(prev => ({
            ...prev,
            isBlockchainEnabled: true,
            isLoading: false,
            error: null
          }))
          return
        }
      } catch (statusError) {
        console.log('Status endpoint not available, trying auth endpoint')
      }
      
      // Fallback to blockchain-auth endpoint with status check
      const { data, error } = await supabase.functions.invoke('blockchain-auth', {
        body: { action: 'status_check' }
      })
      
      if (error) {
        console.warn('Blockchain auth not available:', error.message)
        
        // Check if it's a deployment issue
        if (error.message?.includes('Failed to send a request') || 
            error.message?.includes('CORS') || 
            error.message?.includes('net::ERR_FAILED')) {
          setState(prev => ({
            ...prev,
            isBlockchainEnabled: false,
            isLoading: false,
            error: 'Blockchain functions not deployed. Please deploy edge functions first.'
          }))
        } else {
          setState(prev => ({
            ...prev,
            isBlockchainEnabled: false,
            isLoading: false,
            error: 'Blockchain authentication not available'
          }))
        }
        return
      }
      
      setState(prev => ({
        ...prev,
        isBlockchainEnabled: true,
        isLoading: false,
        error: null
      }))
    } catch (error: any) {
      console.error('Blockchain status check failed:', error)
      setState(prev => ({
        ...prev,
        isBlockchainEnabled: false,
        isLoading: false,
        error: 'Blockchain functions not deployed. Please deploy edge functions first.'
      }))
    }
  }

  const authenticateWithBlockchain = useCallback(async (authEvent: AuthEvent): Promise<boolean> => {
    if (!state.isBlockchainEnabled) {
      console.log('Blockchain authentication not available, skipping')
      return true // Don't block authentication if blockchain is unavailable
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const { data, error } = await supabase.functions.invoke('blockchain-auth', {
        body: authEvent
      })

      if (error) {
        console.error('Blockchain authentication failed:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message
        }))
        
        // Don't block authentication on blockchain failure in development
        if (error.message.includes('simulation mode')) {
          return true
        }
        
        toast({
          title: "Blockchain Authentication Warning",
          description: "Authentication completed but blockchain verification failed",
          variant: "destructive",
        })
        return false
      }

      if (data?.success) {
        setState(prev => ({
          ...prev,
          authToken: data.authToken,
          lastVerification: new Date(),
          isLoading: false,
          error: null
        }))

        console.log('Blockchain authentication successful:', {
          blockchainTx: data.blockchainTx,
          encrypted: data.encrypted
        })

        return true
      }

      return false
    } catch (error: any) {
      console.error('Blockchain authentication error:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }))
      return false
    }
  }, [state.isBlockchainEnabled, toast])

  const verifyDocument = useCallback(async (request: VerificationRequest): Promise<VerificationResult | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const { data, error } = await supabase.functions.invoke('blockchain-verify', {
        body: request
      })

      if (error) {
        console.error('Document verification failed:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message
        }))
        return null
      }

      setState(prev => ({
        ...prev,
        lastVerification: new Date(),
        isLoading: false,
        error: null
      }))

      return data?.verification || null
    } catch (error: any) {
      console.error('Document verification error:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }))
      return null
    }
  }, [])

  const logAuditEvent = useCallback(async (event: {
    action: string
    resourceType: 'transcript' | 'institution' | 'student' | 'auth' | 'system'
    resourceId: string
    details?: Record<string, any>
    severity?: 'low' | 'medium' | 'high' | 'critical'
  }) => {
    try {
      // Use the database function for basic audit logging
      const { error } = await supabase.rpc('log_security_event', {
        p_action: event.action,
        p_resource_type: event.resourceType,
        p_resource_id: event.resourceId,
        p_details: event.details || {},
        p_severity: event.severity || 'low'
      })

      if (error) {
        console.error('Audit logging failed:', error)
        return false
      }

      // If blockchain is enabled, also log to blockchain audit system
      if (state.isBlockchainEnabled) {
        try {
          await supabase.functions.invoke('blockchain-audit', {
            body: {
              action: 'log_event',
              events: event
            }
          })
        } catch (blockchainError) {
          console.warn('Blockchain audit logging failed:', blockchainError)
          // Don't fail the main operation if blockchain logging fails
        }
      }

      return true
    } catch (error: any) {
      console.error('Audit event logging error:', error)
      return false
    }
  }, [state.isBlockchainEnabled])

  const processAuditBatch = useCallback(async (): Promise<boolean> => {
    if (!state.isBlockchainEnabled) {
      console.warn('Blockchain not enabled, skipping batch processing')
      return false
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const { data, error } = await supabase.functions.invoke('blockchain-audit', {
        body: { action: 'process_batch' }
      })

      if (error) {
        console.error('Audit batch processing failed:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message
        }))
        return false
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null
      }))

      if (data?.processedCount > 0) {
        toast({
          title: "Audit Batch Processed",
          description: `${data.processedCount} audit events secured on blockchain`,
        })
      }

      return true
    } catch (error: any) {
      console.error('Audit batch processing error:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }))
      return false
    }
  }, [state.isBlockchainEnabled, toast])

  const verifyBlockchainTransaction = useCallback(async (txHash: string): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('verify_blockchain_transaction', {
        p_transaction_hash: txHash
      })

      if (error) {
        console.error('Transaction verification failed:', error)
        return { valid: false, error: error.message }
      }

      return data
    } catch (error: any) {
      console.error('Transaction verification error:', error)
      return { valid: false, error: error.message }
    }
  }, [])

  const getAuthTokenStatus = useCallback(async (): Promise<{
    valid: boolean
    expiresAt?: Date
    lastUsed?: Date
  }> => {
    if (!state.authToken) {
      return { valid: false }
    }

    try {
      const { data, error } = await supabase
        .from('auth_tokens')
        .select('expires_at, last_used_at, is_revoked')
        .eq('token_hash', state.authToken)
        .single()

      if (error || !data || data.is_revoked) {
        return { valid: false }
      }

      const expiresAt = new Date(data.expires_at)
      const now = new Date()

      return {
        valid: expiresAt > now,
        expiresAt,
        lastUsed: data.last_used_at ? new Date(data.last_used_at) : undefined
      }
    } catch (error: any) {
      console.error('Token status check failed:', error)
      return { valid: false }
    }
  }, [state.authToken])

  return {
    // State
    ...state,
    
    // Authentication functions
    authenticateWithBlockchain,
    checkBlockchainStatus,
    getAuthTokenStatus,
    
    // Verification functions
    verifyDocument,
    verifyBlockchainTransaction,
    
    // Audit functions
    logAuditEvent,
    processAuditBatch,
    
    // Utility functions
    reset: () => setState({
      isBlockchainEnabled: false,
      authToken: null,
      lastVerification: null,
      isLoading: false,
      error: null
    })
  }
}

export type { BlockchainAuthState, AuthEvent, VerificationRequest, VerificationResult }
