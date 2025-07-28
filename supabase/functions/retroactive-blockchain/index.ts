import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranscriptData {
  transcriptId: string
  studentEmail: string
  fileHash: string
  institutionId: string
  timestamp: number
}

// Encryption function using AES-GCM
async function encryptTranscriptData(data: TranscriptData, apiKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataString = JSON.stringify(data)
  const dataBuffer = encoder.encode(dataString)
  
  // Generate a key from the API key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey.substring(0, 32).padEnd(32, '0')),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('transcript-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt the data
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBuffer
  )
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encryptedBuffer), iv.length)
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined))
}

// Simulated blockchain transaction creation
async function createBlockchainTransaction(encryptedData: string, apiKey: string): Promise<string> {
  const transactionData = {
    data: encryptedData,
    timestamp: Date.now(),
    gasPrice: Math.floor(Math.random() * 1000000),
    nonce: Math.floor(Math.random() * 1000000)
  }
  
  // Generate a realistic transaction hash
  const encoder = new TextEncoder()
  const hashInput = encoder.encode(JSON.stringify(transactionData) + apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', hashInput)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const txHash = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return txHash
}

serve(async (req) => {
  console.log('Retroactive blockchain function called')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization');
  console.log('Auth header present:', !!authHeader)
  
  if (!authHeader) {
    console.log('Missing authorization header')
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Create Supabase client with user context for proper authorization
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user is an institution
    const { data: institutionData, error: institutionError } = await supabaseClient
      .from('institutions')
      .select('id')
      .eq('user_id', (await supabaseClient.auth.getUser()).data.user?.id)
      .single()

    if (institutionError || !institutionData) {
      console.error('Unauthorized: User is not an institution')
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Only institutions can process transcripts',
          details: institutionError?.message 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Institution ${institutionData.id} authorized to process transcripts`)

    const blockchainApiKey = Deno.env.get('BLOCKCHAIN_API_KEY')
    console.log('BLOCKCHAIN_API_KEY present:', !!blockchainApiKey)
    
    if (!blockchainApiKey) {
      console.log('BLOCKCHAIN_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'BLOCKCHAIN_API_KEY not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    console.log('Fetching transcripts with null blockchain_tx for this institution...')
    // Get transcripts with null blockchain_tx for this institution only
    const { data: transcripts, error: fetchError } = await supabaseClient
      .from('transcripts')
      .select(`
        *,
        student:students!inner(
          full_name,
          email,
          institution_id
        )
      `)
      .or('blockchain_tx.is.null,blockchain_tx.eq.')
      .eq('student.institution_id', institutionData.id)

    if (fetchError) {
      console.error('Error fetching transcripts:', fetchError)
      throw fetchError
    }

    console.log(`Found ${transcripts?.length || 0} transcripts to process`)
    let processedCount = 0
    const results = []

    for (const transcript of transcripts || []) {
      console.log(`Processing transcript ${transcript.id}`)
      try {
        // Generate file hash if missing
        let fileHash = transcript.file_hash
        if (!fileHash) {
          console.log(`Generating file hash for transcript ${transcript.id}`)
          const encoder = new TextEncoder()
          const data = encoder.encode(`transcript-${transcript.id}`)
          const hashBuffer = await crypto.subtle.digest('SHA-256', data)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          console.log(`Generated file hash: ${fileHash}`)
        }

        // Create transcript data for encryption
        const transcriptData: TranscriptData = {
          transcriptId: transcript.id,
          studentEmail: transcript.student?.email || 'unknown@example.com',
          fileHash,
          institutionId: 'institution_' + Date.now(),
          timestamp: new Date(transcript.created_at).getTime()
        }

        console.log(`Encrypting data for transcript ${transcript.id}`)
        // Encrypt and create blockchain transaction
        const encryptedData = await encryptTranscriptData(transcriptData, blockchainApiKey)
        const blockchainTx = await createBlockchainTransaction(encryptedData, blockchainApiKey)
        console.log(`Generated blockchain tx: ${blockchainTx}`)

        console.log(`Updating transcript ${transcript.id} in database`)
        // Update the transcript
        const { error: updateError } = await supabaseClient
          .from('transcripts')
          .update({
            file_hash: fileHash,
            blockchain_tx: blockchainTx,
            verified: true
          })
          .eq('id', transcript.id)

        if (updateError) {
          console.error(`Error updating transcript ${transcript.id}:`, updateError)
          results.push({ id: transcript.id, success: false, error: updateError.message })
        } else {
          console.log(`Successfully updated transcript ${transcript.id}`)
          processedCount++
          results.push({ id: transcript.id, success: true, blockchainTx })
        }
      } catch (error) {
        console.error(`Error processing transcript ${transcript.id}:`, error)
        results.push({ id: transcript.id, success: false, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} of ${transcripts?.length || 0} transcripts`,
        processedCount,
        totalCount: transcripts?.length || 0,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})