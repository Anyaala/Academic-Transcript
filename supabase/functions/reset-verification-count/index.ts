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

  // Get JWT token from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Create client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create client with user auth for auth checks
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { studentId } = await req.json()

    console.log('Reset request received for student ID:', studentId)

    if (!studentId) {
      return new Response(
        JSON.stringify({ error: 'Student ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the current user to verify they are an institution
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the institution for this user
    const { data: institution, error: institutionError } = await supabaseClient
      .from('institutions')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (institutionError || !institution) {
      return new Response(
        JSON.stringify({ error: 'Institution not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify that the student belongs to this institution
    console.log('Looking for student:', studentId, 'in institution:', institution.id)
    
    const { data: student, error: studentError } = await supabaseClient
      .from('students')
      .select('id, full_name, email, verification_count, verification_limit, institution_id')
      .eq('id', studentId)
      .eq('institution_id', institution.id)
      .single()

    console.log('Student query result:', { student, studentError })

    if (studentError || !student) {
      let errorMessage = 'Student not found or does not belong to your institution';
      
      // Check if the error is related to missing columns
      if (studentError && studentError.message) {
        if (studentError.message.includes('verification_count') || studentError.message.includes('verification_limit')) {
          errorMessage = 'Database columns missing: verification_count and verification_limit need to be added to students table';
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: studentError?.message,
          studentId,
          institutionId: institution.id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Reset the verification count using admin client to bypass RLS
    console.log(`Resetting verification count for student ${studentId} from ${student.verification_count} to 0`)
    
    const { data: updatedStudents, error: updateError } = await supabaseAdmin
      .from('students')
      .update({ 
        verification_count: 0
      })
      .eq('id', studentId)
      .eq('institution_id', institution.id)
      .select('id, full_name, verification_count, verification_limit')

    console.log('Update result:', { updatedStudents, updateError })

    if (updateError) {
      console.error('Error resetting verification count:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to reset verification count', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!updatedStudents || updatedStudents.length === 0) {
      console.error('No students were updated')
      return new Response(
        JSON.stringify({ 
          error: 'No student was updated', 
          details: 'Update query returned no results',
          studentId,
          institutionId: institution.id,
          originalStudent: student
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const updatedStudent = updatedStudents[0]
    console.log('Reset successful, updated student:', JSON.stringify(updatedStudent, null, 2))

    // Log the reset action
    await supabaseAdmin
      .from('verification_attempts')
      .insert({
        student_id: studentId,
        verification_id: 'RESET_BY_INSTITUTION',
        attempted_at: new Date().toISOString(),
        success: true,
        user_agent: `Reset by institution ${institution.id}`
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verification count reset for ${student.full_name}`,
        student: {
          id: student.id,
          name: student.full_name,
          email: student.email,
          verificationCount: 0,
          verificationLimit: student.verification_limit
        }
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
        error: 'Internal server error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
