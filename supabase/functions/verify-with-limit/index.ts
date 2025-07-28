import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { verificationId, ipAddress, userAgent } = await req.json()

    if (!verificationId) {
      return new Response(
        JSON.stringify({ error: 'Verification ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Verifying transcript with ID:', verificationId)

    // Check for recent verification attempts to prevent duplicate submissions
    const { data: recentAttempts, error: attemptsError } = await supabaseClient
      .from('verification_attempts')
      .select('id, attempted_at, success')
      .eq('verification_id', verificationId)
      .gte('attempted_at', new Date(Date.now() - 5000).toISOString()) // Within last 5 seconds
      .limit(5)

    if (recentAttempts && recentAttempts.length > 0) {
      console.log('Recent attempts found:', JSON.stringify(recentAttempts, null, 2))
      
      // If there's a successful attempt within the last 5 seconds, return that result
      const recentSuccess = recentAttempts.find(attempt => attempt.success)
      if (recentSuccess) {
        console.log('Returning cached result for recent successful verification')
        return new Response(
          JSON.stringify({
            error: 'Verification was already completed recently. Please wait a moment before trying again.',
            verified: false
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Find the transcript and student
    const { data: transcript, error: transcriptError } = await supabaseClient
      .from('transcripts')
      .select(`
        *,
        student:students!inner(
          id,
          full_name,
          email,
          verification_count,
          verification_limit,
          institution:institutions!inner(
            id,
            name,
            email
          )
        )
      `)
      .eq('verification_id', verificationId)
      .single()

    if (transcriptError || !transcript) {
      // Log failed attempt
      await supabaseClient
        .from('verification_attempts')
        .insert({
          verification_id: verificationId,
          attempted_at: new Date().toISOString(),
          success: false,
          ip_address: ipAddress,
          user_agent: userAgent
        })

      return new Response(
        JSON.stringify({ 
          error: 'Invalid verification ID',
          verified: false 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const student = transcript.student
    const verificationCount = student.verification_count || 0
    const verificationLimit = student.verification_limit || 5

    console.log(`Student ${student.full_name} verification count: ${verificationCount}/${verificationLimit}`)
    console.log('Student data:', JSON.stringify(student, null, 2))
    console.log('Verification count type:', typeof verificationCount, 'Verification limit type:', typeof verificationLimit)

    // Check if student has exceeded verification limit
    if (verificationCount >= verificationLimit) {
      // Log failed attempt due to limit exceeded
      await supabaseClient
        .from('verification_attempts')
        .insert({
          student_id: student.id,
          verification_id: verificationId,
          attempted_at: new Date().toISOString(),
          success: false,
          ip_address: ipAddress,
          user_agent: userAgent
        })

      return new Response(
        JSON.stringify({ 
          error: `Verification limit exceeded. This student has reached the maximum of ${verificationLimit} verification attempts. Please contact the institution to reset the limit.`,
          verified: false,
          limitExceeded: true,
          verificationCount,
          verificationLimit
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Increment verification count
    const newCount = verificationCount + 1
    console.log(`Incrementing verification count for student ${student.id} from ${verificationCount} to ${newCount}`)
    
    const { data: updatedStudent, error: updateError } = await supabaseClient
      .from('students')
      .update({ 
        verification_count: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', student.id)
      .select('id, full_name, verification_count, verification_limit')
      .single()

    if (updateError) {
      console.error('Error updating verification count:', updateError)
    } else {
      console.log('Updated student verification count:', JSON.stringify(updatedStudent, null, 2))
    }

    // Log successful attempt
    await supabaseClient
      .from('verification_attempts')
      .insert({
        student_id: student.id,
        verification_id: verificationId,
        attempted_at: new Date().toISOString(),
        success: true,
        ip_address: ipAddress,
        user_agent: userAgent
      })

    // Return verification result
    return new Response(
      JSON.stringify({
        verified: true,
        student: {
          name: student.full_name,
          email: student.email
        },
        institution: {
          name: student.institution.name,
          email: student.institution.email
        },
        transcript: {
          id: transcript.id,
          fileUrl: transcript.file_url,
          issuedAt: transcript.issued_at,
          verified: transcript.verified,
          blockchainTx: transcript.blockchain_tx
        },
        verificationCount: verificationCount + 1,
        verificationLimit,
        remainingVerifications: Math.max(0, verificationLimit - (verificationCount + 1))
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        verified: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
