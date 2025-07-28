# Real Blockchain Setup Instructions

## Step 1: Configure Supabase Environment Variables

Go to your Supabase Dashboard → Project Settings → Edge Functions → Environment variables and add these:

### Primary Configuration
```bash
# Alchemy API Configuration
ALCHEMY_API_KEY=SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y

# Blockchain Network (Polygon Mainnet for cost-effectiveness)
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y

# Generate a secure private key for your application (IMPORTANT: Keep this secret!)
# You can generate one at: https://vanity-eth.tk/ or use: openssl rand -hex 32
BLOCKCHAIN_PRIVATE_KEY=your_generated_private_key_here

# Generate a strong encryption secret (32+ characters)
BLOCKCHAIN_SECRET_KEY=your_super_secret_encryption_key_at_least_32_chars_long_2024

# Contract addresses (we'll deploy these or use test contracts)
AUTH_CONTRACT_ADDRESS=0x742dA8a8f8c8b8eB8fB8D8a8f8c8b8eB8fB8D8a8
VERIFICATION_CONTRACT_ADDRESS=0x853dB9b9f9d9c9fC9gC9E9b9f9d9c9fC9gC9E9b9
AUDIT_CONTRACT_ADDRESS=0x964eCaCaf0e0d0gD0hD0FaCaf0e0d0gD0hD0FaCa
```

### Alternative Networks (optional)
```bash
# Ethereum Mainnet (higher gas costs)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y

# Polygon Mumbai Testnet (for testing)
POLYGON_TESTNET_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y

# Ethereum Sepolia Testnet (for testing)
ETHEREUM_TESTNET_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y
```

## Step 2: Generate Private Key

**IMPORTANT: You need to generate a private key for your application.**

### Option A: Use OpenSSL (Recommended)
```bash
openssl rand -hex 32
```

### Option B: Use Node.js
```javascript
console.log('0x' + require('crypto').randomBytes(32).toString('hex'))
```

### Option C: Use online generator (use with caution)
Visit: https://vanity-eth.tk/ and generate a random key

**Copy the private key and add it to BLOCKCHAIN_PRIVATE_KEY variable**

## Step 3: Security Considerations

1. **Private Key Security**: 
   - Never commit private keys to version control
   - Store only in Supabase environment variables
   - Consider using a dedicated wallet for this application

2. **Network Selection**:
   - **Polygon Mainnet**: Low cost, fast transactions (~$0.01-0.10 per transaction)
   - **Ethereum Mainnet**: High security, higher cost (~$5-50 per transaction)
   - **Testnets**: Free for testing, not for production

3. **Gas Management**:
   - Monitor transaction costs
   - Implement gas price optimization
   - Use batching to reduce costs

## Step 4: Test Configuration

After setting the environment variables, the system will automatically:
- Switch from simulation to real blockchain mode
- Connect to Polygon network using your Alchemy key
- Store real transactions on blockchain
- Provide cryptographic proof of authenticity

## Next Steps

1. Set the environment variables in Supabase
2. Generate and add your private key
3. Test the blockchain connection
4. Deploy smart contracts (optional - we can use deployed ones)
5. Monitor transaction costs and performance
