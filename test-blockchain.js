// Quick test of blockchain-transcript function
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nohrizhxwrsinsyyojju.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaHJpemh4d3JzaW5zeXlvamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0MTg5NjMsImV4cCI6MjA2ODk5NDk2M30.z1UYdCfG6hwcQoYJsG6B6GiD1jxn-9VT82-5d_Zex-o'

const supabase = createClient(supabaseUrl, supabaseKey)

// Test the function
async function testBlockchain() {
  console.log('Testing blockchain-transcript function...')
  
  try {
    const { data, error } = await supabase.functions.invoke('blockchain-transcript', {
      body: {
        transcriptId: 'test-transcript-id',
        studentEmail: 'test@student.com',
        fileContent: 'This is test content for blockchain recording'
      }
    })
    
    console.log('Response:', { data, error })
  } catch (err) {
    console.error('Error:', err)
  }
}

testBlockchain()
