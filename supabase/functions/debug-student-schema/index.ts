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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        db: { schema: 'public' },
        auth: { persistSession: false }
      }
    )

    // Check if columns exist
    const { data: columns, error: columnsError } = await supabaseClient
      .from('information_schema.columns')
      .select('column_name, data_type, column_default')
      .eq('table_name', 'students')
      .in('column_name', ['verification_count', 'verification_limit'])

    console.log('Column check result:', { columns, columnsError })

    // Try to get a student with verification fields
    const { data: student, error: studentError } = await supabaseClient
      .from('students')
      .select('id, full_name, verification_count, verification_limit')
      .eq('id', '99f7c435-60a5-4296-a50b-5a6e766cb843')
      .single()

    console.log('Student check result:', { student, studentError })

    // Get all students to see structure
    const { data: allStudents, error: allStudentsError } = await supabaseClient
      .from('students')
      .select('*')
      .limit(1)

    console.log('All students structure:', { allStudents, allStudentsError })

    return new Response(
      JSON.stringify({
        columns: columns,
        columnsError: columnsError?.message,
        student: student,
        studentError: studentError?.message,
        sampleStudent: allStudents?.[0],
        allStudentsError: allStudentsError?.message
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
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
