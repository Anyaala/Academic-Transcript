# 🚀 Deploy Blockchain Edge Functions

## Quick Fix for CORS Error

The CORS error you're seeing means the blockchain edge functions haven't been deployed yet. Let's fix this!

## Step 1: Deploy All Functions

Run this command in your project directory:

```bash
# Make the deployment script executable
chmod +x scripts/deploy-blockchain-functions.sh

# Run the deployment script
./scripts/deploy-blockchain-functions.sh
```

**OR deploy manually one by one:**

```bash
# Deploy test function first
npx supabase functions deploy test-blockchain-connection

# Deploy blockchain authentication
npx supabase functions deploy blockchain-auth

# Deploy blockchain verification
npx supabase functions deploy blockchain-verify

# Deploy blockchain audit
npx supabase functions deploy blockchain-audit
```

## Step 2: Verify Deployment

After deployment, test if functions are working:

```bash
# Test the connection (replace YOUR_PROJECT_ID with your actual project ID)
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/test-blockchain-connection

# Test blockchain auth status
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/blockchain-auth \
  -H "Content-Type: application/json" \
  -d '{"action": "status_check"}'
```

You should get responses like:
```json
{
  "success": true,
  "blockchain_available": true,
  "message": "Blockchain authentication service is available"
}
```

## Step 3: Set Environment Variables (If Not Done Already)

In Supabase Dashboard → Project Settings → Edge Functions → Environment variables:

```bash
# Your Alchemy API Key
ALCHEMY_API_KEY=SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y

# Blockchain RPC URL
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y

# Generate this with: openssl rand -hex 32
BLOCKCHAIN_PRIVATE_KEY=0x[your_private_key_here]

# Strong encryption secret (32+ characters)
BLOCKCHAIN_SECRET_KEY=your_super_secret_encryption_key_at_least_32_chars_long_2024
```

## Step 4: Test in Your Application

After deployment, refresh your application and the CORS error should be gone. The system will automatically:

1. ✅ Detect deployed functions
2. ✅ Switch from simulation to real blockchain (if configured)
3. ✅ Start logging authentication events
4. ✅ Enable blockchain verification

## Troubleshooting

### If deployment fails:

1. **Check Supabase CLI is logged in:**
   ```bash
   npx supabase login
   ```

2. **Link to your project:**
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_ID
   ```

3. **Check you're in the correct directory:**
   ```bash
   ls supabase/functions/
   # Should show: blockchain-auth, blockchain-verify, blockchain-audit, test-blockchain-connection
   ```

### If functions deploy but still get errors:

1. **Check function logs in Supabase Dashboard:**
   - Go to Edge Functions → Select function → Logs

2. **Verify environment variables are set:**
   - Go to Project Settings → Edge Functions → Environment variables

3. **Test individual functions:**
   ```bash
   # Test each function URL in browser or curl
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/blockchain-auth
   ```

### If authentication errors persist:

1. **Check if you need to be logged in:**
   - Some functions require user authentication
   - Make sure you're logged into your app

2. **Verify CORS headers:**
   - All functions should have proper CORS headers
   - Check browser network tab for actual error details

## Expected Behavior After Deployment

✅ **Before Deployment:**
- CORS errors in browser console
- "Blockchain functions not deployed" message
- Simulation mode only

✅ **After Deployment:**
- No CORS errors
- Blockchain status check passes
- Real blockchain mode available (if configured)
- Authentication events logged

## Function URLs

After deployment, your functions will be available at:

- **Test**: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/test-blockchain-connection`
- **Auth**: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/blockchain-auth`
- **Verify**: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/blockchain-verify`
- **Audit**: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/blockchain-audit`

Replace `YOUR_PROJECT_ID` with your actual Supabase project reference ID.

## Next Steps

Once deployed:

1. 🔧 Set environment variables for real blockchain
2. 💰 Add some MATIC to your wallet for gas fees
3. 🧪 Test authentication and verification
4. 📊 Monitor transaction costs and performance
5. 🔒 Enable production security features

The CORS error will be resolved once the functions are deployed! 🎉
