import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@6.8.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Smart contract ABI for document verification
const VERIFICATION_CONTRACT_ABI = [
  "function verifyDocument(string memory documentHash) public view returns (bool, uint256, address)",
  "function getDocumentDetails(string memory documentHash) public view returns (string memory, uint256, address, bool)",
  "function recordDocument(string memory documentHash, string memory metadata) public returns (bytes32)",
  "function revokeDocument(string memory documentHash) public returns (bool)",
  "event DocumentRecorded(string indexed documentHash, address indexed institution, uint256 timestamp)",
  "event DocumentVerified(string indexed documentHash, address indexed verifier, uint256 timestamp)"
]

// Initialize blockchain connection
function initBlockchain() {
  try {
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY')
    const rpcUrl = Deno.env.get('BLOCKCHAIN_RPC_URL') || 
                   (alchemyKey ? `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}` : null)
    const privateKey = Deno.env.get('BLOCKCHAIN_PRIVATE_KEY')
    const contractAddress = Deno.env.get('VERIFICATION_CONTRACT_ADDRESS')
    
    console.log('Blockchain verification initialization:', {
      has_alchemy_key: !!alchemyKey,
      has_rpc_url: !!rpcUrl,
      has_private_key: !!privateKey,
      has_contract_address: !!contractAddress
    })
    
    if (!rpcUrl || !privateKey) {
      console.log('Blockchain not fully configured, using simulation mode')
      return null
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(privateKey, provider)
    
    let contract = null
    if (contractAddress && contractAddress !== '0x' + '0'.repeat(40)) {
      contract = new ethers.Contract(contractAddress, VERIFICATION_CONTRACT_ABI, wallet)
      console.log('Verification contract initialized:', contractAddress)
    } else {
      console.log('No verification contract address, using basic verification')
    }
    
    return { provider, wallet, contract }
  } catch (error) {
    console.error('Failed to initialize blockchain:', error)
    return null
  }
}

// Verify document on blockchain
async function verifyOnBlockchain(
  blockchain: any,
  documentHash: string
): Promise<VerificationResult> {
  if (!blockchain) {
    // Simulation mode - simulate blockchain verification
    const isValid = documentHash.length === 64 && /^[a-f0-9]+$/i.test(documentHash)
    return {
      valid: isValid,
      timestamp: Date.now(),
      blockNumber: Math.floor(Math.random() * 1000000),
      metadata: { simulated: true }
    }
  }
  
  try {
    // Real blockchain verification
    const [isValid, timestamp, institutionAddress] = await blockchain.contract.verifyDocument(documentHash)
    
    if (isValid) {
      // Get detailed information
      const [metadata, recordTime, institution, isActive] = await blockchain.contract.getDocumentDetails(documentHash)
      
      return {
        valid: isValid && isActive,
        timestamp: Number(timestamp),
        institutionAddress,
        documentHash,
        metadata: JSON.parse(metadata || '{}')
      }
    }
    
    return { valid: false }
  } catch (error) {
    console.error('Blockchain verification failed:', error)
    return { valid: false }
  }
}

// Verify transaction hash on blockchain
async function verifyTransaction(
  blockchain: any,
  txHash: string
): Promise<VerificationResult> {
  if (!blockchain) {
    // Simulation mode
    const isValid = txHash.startsWith('0x') && txHash.length === 66
    return {
      valid: isValid,
      timestamp: Date.now(),
      metadata: { simulated: true }
    }
  }
  
  try {
    const tx = await blockchain.provider.getTransaction(txHash)
    const receipt = await blockchain.provider.getTransactionReceipt(txHash)
    
    if (!tx || !receipt) {
      return { valid: false }
    }
    
    return {
      valid: receipt.status === 1,
      timestamp: Date.now(),
      blockNumber: receipt.blockNumber,
      transactionDetails: {
        from: tx.from,
        to: tx.to,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: tx.gasPrice?.toString(),
        blockHash: receipt.blockHash
      }
    }
  } catch (error) {
    console.error('Transaction verification failed:', error)
    return { valid: false }
  }
}

// Enhanced cryptographic verification
async function verifyDocumentIntegrity(
  fileContent: ArrayBuffer,
  expectedHash: string
): Promise<boolean> {
  try {
    // Calculate SHA-256 hash of the file
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileContent)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return calculatedHash === expectedHash
  } catch (error) {
    console.error('Document integrity verification failed:', error)
    return false
  }
}

// Rate limiting for verification requests
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(clientIP: string): boolean {
  const now = Date.now()
  const limit = 10 // 10 requests per minute
  const window = 60000 // 1 minute
  
  const clientData = rateLimitMap.get(clientIP)
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + window })
    return true
  }
  
  if (clientData.count >= limit) {
    return false
  }
  
  clientData.count++
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const body: VerificationRequest = await req.json()
    const { action, verificationId, fileHash, blockchainTx } = body
    
    // Initialize blockchain
    const blockchain = initBlockchain()
    
    // Initialize Supabase client (no auth required for verification)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    
    let result: VerificationResult = { valid: false }
    
    switch (action) {
      case 'verify_id':
        if (!verificationId) {
          throw new Error('Verification ID is required')
        }
        
        // Look up transcript by verification ID
        const { data: transcript, error } = await supabaseClient
          .from('transcripts')
          .select(`
            *,
            student:students!inner(
              full_name,
              email,
              institutions!students_institution_id_fkey(name)
            )
          `)
          .eq('verification_id', verificationId)
          .single()
        
        if (error || !transcript) {
          result = { valid: false }
          break
        }
        
        // Verify on blockchain if available
        if (transcript.file_hash) {
          const blockchainResult = await verifyOnBlockchain(blockchain, transcript.file_hash)
          result = {
            ...blockchainResult,
            metadata: {
              ...blockchainResult.metadata,
              studentName: transcript.student?.full_name,
              institution: transcript.student?.institutions?.name,
              issueDate: transcript.issued_at,
              verificationId: transcript.verification_id
            }
          }
        } else {
          result = {
            valid: transcript.verified,
            metadata: {
              studentName: transcript.student?.full_name,
              institution: transcript.student?.institutions?.name,
              issueDate: transcript.issued_at,
              verificationId: transcript.verification_id,
              blockchainVerified: false
            }
          }
        }
        break
        
      case 'verify_hash':
        if (!fileHash) {
          throw new Error('File hash is required')
        }
        
        result = await verifyOnBlockchain(blockchain, fileHash)
        break
        
      case 'verify_transaction':
        if (!blockchainTx) {
          throw new Error('Transaction hash is required')
        }
        
        result = await verifyTransaction(blockchain, blockchainTx)
        break
        
      default:
        throw new Error('Invalid verification action')
    }
    
    // Log verification attempt
    const logData = {
      action,
      client_ip: clientIP,
      verification_id: verificationId,
      file_hash: fileHash,
      blockchain_tx: blockchainTx,
      result: result.valid,
      timestamp: new Date().toISOString()
    }
    
    // Store verification log (fire and forget)
    supabaseClient
      .from('verification_logs')
      .insert(logData)
      .then(() => console.log('Verification logged'))
      .catch(err => console.error('Failed to log verification:', err))
    
    return new Response(
      JSON.stringify({
        success: true,
        verification: result,
        timestamp: Date.now(),
        blockchain_enabled: !!blockchain
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Verification error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
