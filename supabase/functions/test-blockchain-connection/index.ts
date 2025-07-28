import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { ethers } from 'https://esm.sh/ethers@6.8.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const testResults = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      tests: {} as Record<string, any>
    }

    // Test 1: Environment Variables
    console.log('Testing environment variables...')
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY')
    const rpcUrl = Deno.env.get('BLOCKCHAIN_RPC_URL')
    const privateKey = Deno.env.get('BLOCKCHAIN_PRIVATE_KEY')
    const secretKey = Deno.env.get('BLOCKCHAIN_SECRET_KEY')

    testResults.tests.environment = {
      alchemy_key_present: !!alchemyKey,
      alchemy_key_format: alchemyKey?.startsWith('SEGx8kDYwD6tsQjHlJVkq') || false,
      rpc_url_present: !!rpcUrl,
      rpc_url_format: rpcUrl?.includes('alchemy.com') || false,
      private_key_present: !!privateKey,
      private_key_format: privateKey?.startsWith('0x') && privateKey?.length === 66,
      secret_key_present: !!secretKey,
      secret_key_length: secretKey?.length || 0
    }

    // Test 2: Network Connection
    console.log('Testing network connection...')
    if (rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        
        // Test basic connection
        const network = await provider.getNetwork()
        const blockNumber = await provider.getBlockNumber()
        const gasPrice = await provider.getFeeData()
        
        testResults.tests.network = {
          connected: true,
          network_name: network.name,
          chain_id: Number(network.chainId),
          block_number: blockNumber,
          gas_price_gwei: ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei'),
          max_fee_per_gas: ethers.formatUnits(gasPrice.maxFeePerGas || 0, 'gwei'),
          max_priority_fee: ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0, 'gwei')
        }
        
        console.log(`Connected to ${network.name} (Chain ID: ${network.chainId})`)
        console.log(`Current block: ${blockNumber}`)
      } catch (networkError) {
        console.error('Network connection failed:', networkError)
        testResults.tests.network = {
          connected: false,
          error: networkError.message
        }
      }
    } else {
      testResults.tests.network = {
        connected: false,
        error: 'RPC URL not configured'
      }
    }

    // Test 3: Wallet Connection
    console.log('Testing wallet connection...')
    if (privateKey && rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        const wallet = new ethers.Wallet(privateKey, provider)
        
        const address = wallet.address
        const balance = await provider.getBalance(address)
        
        testResults.tests.wallet = {
          connected: true,
          address: address,
          balance_eth: ethers.formatEther(balance),
          balance_wei: balance.toString(),
          has_funds: balance > 0n
        }
        
        console.log(`Wallet address: ${address}`)
        console.log(`Balance: ${ethers.formatEther(balance)} ETH`)
      } catch (walletError) {
        console.error('Wallet connection failed:', walletError)
        testResults.tests.wallet = {
          connected: false,
          error: walletError.message
        }
      }
    } else {
      testResults.tests.wallet = {
        connected: false,
        error: 'Private key or RPC URL not configured'
      }
    }

    // Test 4: Contract Interaction (if addresses provided)
    console.log('Testing contract interaction...')
    const authContract = Deno.env.get('AUTH_CONTRACT_ADDRESS')
    const verificationContract = Deno.env.get('VERIFICATION_CONTRACT_ADDRESS')
    
    if (authContract && verificationContract && privateKey && rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        const wallet = new ethers.Wallet(privateKey, provider)
        
        // Test contract code exists
        const authCode = await provider.getCode(authContract)
        const verificationCode = await provider.getCode(verificationContract)
        
        testResults.tests.contracts = {
          auth_contract_deployed: authCode !== '0x',
          auth_contract_address: authContract,
          verification_contract_deployed: verificationCode !== '0x',
          verification_contract_address: verificationContract,
          contracts_ready: authCode !== '0x' && verificationCode !== '0x'
        }
      } catch (contractError) {
        console.error('Contract test failed:', contractError)
        testResults.tests.contracts = {
          error: contractError.message
        }
      }
    } else {
      testResults.tests.contracts = {
        configured: false,
        note: 'Contract addresses not configured - using fallback mode'
      }
    }

    // Test 5: Encryption Test
    console.log('Testing encryption...')
    if (secretKey) {
      try {
        const testData = { test: 'blockchain_encryption', timestamp: Date.now() }
        const encoder = new TextEncoder()
        const dataBuffer = encoder.encode(JSON.stringify(testData))
        
        // Test encryption
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
            salt: encoder.encode('test-salt'),
            iterations: 150000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        )
        
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          dataBuffer
        )
        
        testResults.tests.encryption = {
          working: true,
          secret_key_length: secretKey.length,
          encrypted_size: encrypted.byteLength,
          algorithm: 'AES-GCM-256'
        }
      } catch (encryptionError) {
        console.error('Encryption test failed:', encryptionError)
        testResults.tests.encryption = {
          working: false,
          error: encryptionError.message
        }
      }
    } else {
      testResults.tests.encryption = {
        working: false,
        error: 'Secret key not configured'
      }
    }

    // Test Summary
    const allTests = Object.values(testResults.tests)
    const passedTests = allTests.filter(test => 
      test.connected === true || 
      test.working === true || 
      test.contracts_ready === true ||
      (test.alchemy_key_present && test.rpc_url_present)
    ).length

    testResults.summary = {
      total_tests: allTests.length,
      passed_tests: passedTests,
      overall_status: passedTests >= 3 ? 'READY' : 'NEEDS_CONFIGURATION',
      blockchain_mode: passedTests >= 3 ? 'PRODUCTION' : 'SIMULATION',
      next_steps: passedTests < 3 ? [
        'Set ALCHEMY_API_KEY environment variable',
        'Set BLOCKCHAIN_RPC_URL environment variable', 
        'Generate and set BLOCKCHAIN_PRIVATE_KEY',
        'Set BLOCKCHAIN_SECRET_KEY (32+ characters)',
        'Optionally deploy smart contracts'
      ] : [
        'Blockchain is ready for production use!',
        'Monitor transaction costs and gas prices',
        'Consider deploying custom smart contracts',
        'Set up monitoring and alerts'
      ]
    }

    console.log(`Test completed: ${testResults.summary.overall_status}`)
    console.log(`Blockchain mode: ${testResults.summary.blockchain_mode}`)

    return new Response(
      JSON.stringify(testResults, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Test error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
