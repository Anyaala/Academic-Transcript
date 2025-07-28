import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerificationRequest {
  verification_id: string;
  ip_address?: string;
}

Deno.serve(async (req) => {
  console.log('Verify transcript function called')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { verification_id, ip_address }: VerificationRequest = await req.json()
    
    console.log(`Verifying transcript: ${verification_id}`)

    // Input validation
    if (!verification_id || typeof verification_id !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid verification ID format',
          status: 'invalid' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate verification ID format (VT-timestamp-random)
    const verificationIdRegex = /^VT-\d+-[a-z0-9]+$/i
    if (!verificationIdRegex.test(verification_id.trim())) {
      return new Response(
        JSON.stringify({ 
          error: 'Verification ID must be in the format VT-XXXXXXXXX-XXXXXXX',
          status: 'invalid' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract IP address for rate limiting
    const clientIP = ip_address || 
      req.headers.get('x-forwarded-for')?.split(',')[0] || 
      req.headers.get('x-real-ip') || 
      'unknown'

    console.log(`Rate limiting check for IP: ${clientIP}`)

    // Check rate limiting
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
      .rpc('check_verification_rate_limit', {
        p_ip_address: clientIP,
        p_verification_id: verification_id
      })

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError)
    }

    if (!rateLimitCheck) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`)
      return new Response(
        JSON.stringify({ 
          error: 'Too many verification attempts. Please try again later.',
          status: 'rate_limited' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // First, query the transcript
    console.log(`Querying transcript with ID: ${verification_id.trim()}`)
    const { data: transcript, error: transcriptError } = await supabaseClient
      .from('transcripts')
      .select('*')
      .eq('verification_id', verification_id.trim())
      .maybeSingle()
    
    console.log(`Transcript query result:`, { transcript, transcriptError })

    if (transcriptError) {
      console.log('Transcript query error:', transcriptError)
      return new Response(
        JSON.stringify({
          status: "invalid",
          message: "Database error",
          error: transcriptError.message
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!transcript) {
      console.log(`Verification ID not found: ${verification_id}`)
      return new Response(
        JSON.stringify({
          status: "invalid",
          message: "Verification ID not found",
          error: "Invalid verification ID"
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get student and institution data
    const { data: student, error: studentError } = await supabaseClient
      .from('students')
      .select(`
        full_name,
        institutions(name)
      `)
      .eq('id', transcript.student_id)
      .maybeSingle()

    if (studentError) {
      console.log('Student query error:', studentError)
      // Continue without student data if there's an error
    }

    // Log successful verification attempt
    try {
      await supabaseClient.rpc('log_audit_event', {
        p_action: 'transcript_verification',
        p_resource_type: 'transcript',
        p_resource_id: transcript.id,
        p_details: { 
          verification_id: verification_id,
          ip_address: clientIP,
          verified_status: transcript.verified 
        }
      })
    } catch (logError) {
      console.warn('Failed to log verification event:', logError)
    }

    console.log(`Transcript found: ${transcript.id}, verified: ${transcript.verified}`)

    // Return verification result
    const result = {
      status: transcript.verified ? "verified" : "pending",
      verificationId: transcript.verification_id,
      studentName: student?.full_name || "Unknown Student",
      institution: student?.institutions?.name || "Unknown Institution",
      issueDate: new Date(transcript.issued_at).toLocaleDateString(),
      createdDate: new Date(transcript.created_at).toLocaleDateString(),
      blockchainTx: transcript.blockchain_tx || "Pending",
      fileHash: transcript.file_hash || "Processing",
      transcriptId: transcript.id
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Verification error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Verification failed',
        status: 'error',
        message: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})