import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@6.8.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuditEvent {
  userId: string
  action: string
  resourceType: 'transcript' | 'institution' | 'student' | 'auth' | 'system'
  resourceId: string
  details: Record<string, any>
  timestamp: number
  ipAddress?: string
  userAgent?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface AuditChain {
  previousHash: string
  currentHash: string
  merkleRoot: string
  blockNumber?: number
  timestamp: number
}

// Create Merkle tree for batch audit logging
class MerkleTree {
  private leaves: string[]
  
  constructor(data: string[]) {
    this.leaves = data.map(item => this.hash(item))
  }
  
  private hash(data: string): string {
    const encoder = new TextEncoder()
    return Array.from(new Uint8Array(
      crypto.subtle.digestSync('SHA-256', encoder.encode(data))
    )).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  
  private pairwiseHash(left: string, right: string): string {
    return this.hash(left + right)
  }
  
  getRoot(): string {
    if (this.leaves.length === 0) return ''
    if (this.leaves.length === 1) return this.leaves[0]
    
    let level = [...this.leaves]
    
    while (level.length > 1) {
      const nextLevel: string[] = []
      
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          nextLevel.push(this.pairwiseHash(level[i], level[i + 1]))
        } else {
          nextLevel.push(level[i])
        }
      }
      
      level = nextLevel
    }
    
    return level[0]
  }
  
  getProof(index: number): string[] {
    const proof: string[] = []
    let level = [...this.leaves]
    let currentIndex = index
    
    while (level.length > 1) {
      const nextLevel: string[] = []
      
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          nextLevel.push(this.pairwiseHash(level[i], level[i + 1]))
          
          if (i === currentIndex || i + 1 === currentIndex) {
            proof.push(level[i === currentIndex ? i + 1 : i])
          }
        } else {
          nextLevel.push(level[i])
        }
      }
      
      currentIndex = Math.floor(currentIndex / 2)
      level = nextLevel
    }
    
    return proof
  }
}

// Initialize blockchain for audit logging
function initAuditBlockchain() {
  try {
    const rpcUrl = Deno.env.get('BLOCKCHAIN_RPC_URL') || 'https://polygon-mainnet.g.alchemy.com/v2/' + Deno.env.get('ALCHEMY_API_KEY')
    const privateKey = Deno.env.get('BLOCKCHAIN_PRIVATE_KEY')
    const contractAddress = Deno.env.get('AUDIT_CONTRACT_ADDRESS')
    
    if (!privateKey || !contractAddress) {
      console.log('Audit blockchain not configured, using local chain simulation')
      return null
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(privateKey, provider)
    
    // Audit contract ABI
    const auditContract = new ethers.Contract(contractAddress, [
      "function recordAuditBatch(string memory merkleRoot, uint256 timestamp, string memory metadata) public returns (bytes32)",
      "function verifyAuditEntry(string memory entryHash, string[] memory proof, string memory merkleRoot) public pure returns (bool)",
      "function getAuditBatch(bytes32 batchId) public view returns (string memory, uint256, string memory)",
      "event AuditBatchRecorded(bytes32 indexed batchId, string merkleRoot, uint256 timestamp)"
    ], wallet)
    
    return { provider, wallet, contract: auditContract }
  } catch (error) {
    console.error('Failed to initialize audit blockchain:', error)
    return null
  }
}

// Enhanced encryption for audit data
async function encryptAuditData(auditEvent: AuditEvent, secretKey: string): Promise<string> {
  const encoder = new TextEncoder()
  
  // Add integrity metadata
  const enrichedEvent = {
    ...auditEvent,
    integrity: {
      version: '1.0',
      encryptedAt: Date.now(),
      salt: Array.from(crypto.getRandomValues(new Uint8Array(16)))
    }
  }
  
  const dataBuffer = encoder.encode(JSON.stringify(enrichedEvent))
  
  // Derive encryption key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey.substring(0, 32).padEnd(32, '0')),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('audit-security-salt-2024'),
      iterations: 200000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBuffer
  )
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encryptedBuffer), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

// Create audit chain for immutability
async function createAuditChain(
  auditEvents: AuditEvent[],
  previousHash: string = '0'.repeat(64)
): Promise<AuditChain> {
  const encoder = new TextEncoder()
  
  // Create Merkle tree from audit events
  const eventHashes = auditEvents.map(event => 
    Array.from(new Uint8Array(
      crypto.subtle.digestSync('SHA-256', encoder.encode(JSON.stringify(event)))
    )).map(b => b.toString(16).padStart(2, '0')).join('')
  )
  
  const merkleTree = new MerkleTree(eventHashes)
  const merkleRoot = merkleTree.getRoot()
  
  // Create current block hash
  const blockData = {
    previousHash,
    merkleRoot,
    timestamp: Date.now(),
    eventCount: auditEvents.length
  }
  
  const currentHashBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(JSON.stringify(blockData))
  )
  const currentHash = Array.from(new Uint8Array(currentHashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  
  return {
    previousHash,
    currentHash,
    merkleRoot,
    timestamp: blockData.timestamp
  }
}

// Record audit batch on blockchain
async function recordAuditBatch(
  blockchain: any,
  auditChain: AuditChain,
  metadata: Record<string, any>
): Promise<string> {
  if (!blockchain) {
    // Simulation mode
    const encoder = new TextEncoder()
    const batchData = { ...auditChain, metadata }
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(batchData)))
    const batchId = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    
    console.log('Simulated audit batch recorded:', batchId)
    return batchId
  }
  
  try {
    const tx = await blockchain.contract.recordAuditBatch(
      auditChain.merkleRoot,
      auditChain.timestamp,
      JSON.stringify(metadata)
    )
    
    const receipt = await tx.wait()
    console.log('Audit batch recorded on blockchain:', tx.hash)
    return tx.hash
  } catch (error) {
    console.error('Failed to record audit batch:', error)
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )
    
    const body = await req.json()
    const { action, events } = body
    
    // Get user context
    const { data: userData, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !userData.user) {
      throw new Error('Invalid authentication')
    }
    
    const blockchain = initAuditBlockchain()
    const secretKey = Deno.env.get('BLOCKCHAIN_SECRET_KEY') || 'default-development-key-not-secure'
    
    if (action === 'log_event') {
      // Single event logging
      const auditEvent: AuditEvent = {
        ...events,
        userId: userData.user.id,
        timestamp: Date.now(),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      }
      
      // Encrypt audit data
      const encryptedData = await encryptAuditData(auditEvent, secretKey)
      
      // Store in database
      const { error: insertError } = await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: auditEvent.userId,
          action: auditEvent.action,
          resource_type: auditEvent.resourceType,
          resource_id: auditEvent.resourceId,
          details: auditEvent.details,
          severity: auditEvent.severity,
          encrypted_data: encryptedData,
          ip_address: auditEvent.ipAddress,
          user_agent: auditEvent.userAgent,
          created_at: new Date(auditEvent.timestamp).toISOString()
        })
      
      if (insertError) {
        console.error('Failed to store audit log:', insertError)
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          auditId: auditEvent.timestamp.toString(),
          encrypted: true,
          message: 'Audit event recorded successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    if (action === 'process_batch') {
      // Get pending audit logs
      const { data: pendingLogs, error: fetchError } = await supabaseClient
        .from('audit_logs')
        .select('*')
        .is('blockchain_tx', null)
        .order('created_at', { ascending: true })
        .limit(100)
      
      if (fetchError || !pendingLogs || pendingLogs.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No pending audit logs to process',
            processedCount: 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
      
      // Convert to audit events
      const auditEvents: AuditEvent[] = pendingLogs.map(log => ({
        userId: log.user_id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        details: log.details,
        timestamp: new Date(log.created_at).getTime(),
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        severity: log.severity
      }))
      
      // Get previous hash from last batch
      const { data: lastBatch } = await supabaseClient
        .from('audit_batches')
        .select('current_hash')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      const previousHash = lastBatch?.current_hash || '0'.repeat(64)
      
      // Create audit chain
      const auditChain = await createAuditChain(auditEvents, previousHash)
      
      // Record on blockchain
      const batchMetadata = {
        eventCount: auditEvents.length,
        firstEventTime: Math.min(...auditEvents.map(e => e.timestamp)),
        lastEventTime: Math.max(...auditEvents.map(e => e.timestamp))
      }
      
      const batchId = await recordAuditBatch(blockchain, auditChain, batchMetadata)
      
      // Store batch record
      const { error: batchError } = await supabaseClient
        .from('audit_batches')
        .insert({
          batch_id: batchId,
          previous_hash: auditChain.previousHash,
          current_hash: auditChain.currentHash,
          merkle_root: auditChain.merkleRoot,
          event_count: auditEvents.length,
          metadata: batchMetadata,
          blockchain_tx: batchId,
          created_at: new Date(auditChain.timestamp).toISOString()
        })
      
      if (batchError) {
        console.error('Failed to store batch record:', batchError)
      }
      
      // Update audit logs with batch ID
      const logIds = pendingLogs.map(log => log.id)
      const { error: updateError } = await supabaseClient
        .from('audit_logs')
        .update({ blockchain_tx: batchId })
        .in('id', logIds)
      
      if (updateError) {
        console.error('Failed to update audit logs:', updateError)
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          batchId,
          processedCount: auditEvents.length,
          merkleRoot: auditChain.merkleRoot,
          currentHash: auditChain.currentHash,
          message: 'Audit batch processed successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    throw new Error('Invalid action')
  } catch (error) {
    console.error('Audit processing error:', error)
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
