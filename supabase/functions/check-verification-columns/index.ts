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

    // Check if verification columns exist by querying a student
    const { data: students, error } = await supabaseClient
      .from('students')
      .select('id, full_name, email, verification_count, verification_limit')
      .limit(1)

    if (error) {
      console.error('Error checking columns:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          details: error.message,
          columnsMissing: error.message.includes('verification_count') || error.message.includes('verification_limit')
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check verification_attempts table
    const { data: attempts, error: attemptsError } = await supabaseClient
      .from('verification_attempts')
      .select('id')
      .limit(1)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification columns exist',
        studentsCount: students?.length || 0,
        sampleStudent: students?.[0] || null,
        attemptsTableExists: !attemptsError,
        attemptsError: attemptsError?.message
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
