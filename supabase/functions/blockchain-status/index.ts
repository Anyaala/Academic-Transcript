import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Simple status check that works without authentication
    const response = {
      success: true,
      blockchain_available: true,
      timestamp: Date.now(),
      message: 'Blockchain authentication service is available',
      functions_deployed: true,
      project_id: 'nohrizhxwrsinsyyojju',
      environment: {
        alchemy_key_present: !!Deno.env.get('ALCHEMY_API_KEY'),
        rpc_url_present: !!Deno.env.get('BLOCKCHAIN_RPC_URL'),
        private_key_present: !!Deno.env.get('BLOCKCHAIN_PRIVATE_KEY'),
        secret_key_present: !!Deno.env.get('BLOCKCHAIN_SECRET_KEY')
      }
    }

    return new Response(
      JSON.stringify(response, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Status check error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: Date.now()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
