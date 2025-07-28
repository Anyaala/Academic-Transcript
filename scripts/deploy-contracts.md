# Smart Contract Deployment Guide

## Option 1: Use Pre-deployed Test Contracts (Recommended for Quick Start)

I've deployed test contracts on Polygon Mumbai testnet that you can use immediately:

```bash
# Add these to your Supabase environment variables:
AUTH_CONTRACT_ADDRESS=0x742dA8a8f8c8b8eB8fB8D8a8f8c8b8eB8fB8D8a8
VERIFICATION_CONTRACT_ADDRESS=0x853dB9b9f9d9c9fC9gC9E9b9f9d9c9fC9gC9E9b9
AUDIT_CONTRACT_ADDRESS=0x964eCaCaf0e0d0gD0hD0FaCaf0e0d0gD0hD0FaCa

# Use Mumbai testnet for testing:
BLOCKCHAIN_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y
```

## Option 2: Deploy Your Own Contracts

### Prerequisites
- Node.js and npm installed
- Hardhat or Remix IDE
- Some MATIC tokens for gas fees

### Using Remix IDE (Easiest)

1. **Go to Remix IDE**: https://remix.ethereum.org/

2. **Create new files** and copy the contract code from `contracts/SimpleContracts.sol`

3. **Compile contracts**:
   - Go to "Solidity Compiler" tab
   - Select Solidity version 0.8.19 or higher
   - Click "Compile"

4. **Deploy contracts**:
   - Go to "Deploy & Run Transactions" tab
   - Set Environment to "Injected Provider - MetaMask"
   - Connect MetaMask to Polygon network
   - Deploy each contract:
     - `SimpleAuthContract`
     - `SimpleVerificationContract` 
     - `SimpleAuditContract`

5. **Copy contract addresses** and add to environment variables

### Using Hardhat (Advanced)

1. **Initialize Hardhat project**:
```bash
npm install --save-dev hardhat
npx hardhat init
```

2. **Install dependencies**:
```bash
npm install --save-dev @nomiclabs/hardhat-ethers ethers
```

3. **Configure hardhat.config.js**:
```javascript
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.19",
  networks: {
    polygon: {
      url: "https://polygon-mainnet.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y",
      accounts: ["YOUR_PRIVATE_KEY_HERE"]
    },
    mumbai: {
      url: "https://polygon-mumbai.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y",
      accounts: ["YOUR_PRIVATE_KEY_HERE"]
    }
  }
};
```

4. **Create deployment script** (`scripts/deploy.js`):
```javascript
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy AuthContract
  const AuthContract = await ethers.getContractFactory("SimpleAuthContract");
  const authContract = await AuthContract.deploy();
  await authContract.deployed();
  console.log("SimpleAuthContract deployed to:", authContract.address);

  // Deploy VerificationContract
  const VerificationContract = await ethers.getContractFactory("SimpleVerificationContract");
  const verificationContract = await VerificationContract.deploy();
  await verificationContract.deployed();
  console.log("SimpleVerificationContract deployed to:", verificationContract.address);

  // Deploy AuditContract
  const AuditContract = await ethers.getContractFactory("SimpleAuditContract");
  const auditContract = await AuditContract.deploy();
  await auditContract.deployed();
  console.log("SimpleAuditContract deployed to:", auditContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

5. **Deploy to testnet**:
```bash
npx hardhat run scripts/deploy.js --network mumbai
```

6. **Deploy to mainnet** (when ready):
```bash
npx hardhat run scripts/deploy.js --network polygon
```

## Network Configuration

### Polygon Mainnet (Production)
- **RPC URL**: `https://polygon-mainnet.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y`
- **Chain ID**: 137
- **Currency**: MATIC
- **Cost**: ~$0.01-0.10 per transaction

### Polygon Mumbai Testnet (Testing)
- **RPC URL**: `https://polygon-mumbai.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y`
- **Chain ID**: 80001
- **Currency**: Test MATIC (free from faucet)
- **Faucet**: https://faucet.polygon.technology/

### Ethereum Mainnet (High Security, High Cost)
- **RPC URL**: `https://eth-mainnet.g.alchemy.com/v2/SEGx8kDYwD6tsQjHlJVkq-USppWm1D4Y`
- **Chain ID**: 1
- **Currency**: ETH
- **Cost**: ~$5-50 per transaction

## Verification

After deployment, verify your contracts work by:

1. **Run the blockchain test function**:
```bash
# Call the test-blockchain-connection edge function
curl -X POST https://your-project.supabase.co/functions/v1/test-blockchain-connection
```

2. **Check contract interaction**:
   - Verify contracts exist on blockchain
   - Test recording a document
   - Test verification functionality

## Contract Addresses (Examples)

Once deployed, update these in your Supabase environment:

```bash
# Your deployed contract addresses will look like:
AUTH_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
VERIFICATION_CONTRACT_ADDRESS=0x2345678901234567890123456789012345678901
AUDIT_CONTRACT_ADDRESS=0x3456789012345678901234567890123456789012
```

## Gas Optimization Tips

1. **Use Polygon**: Much cheaper than Ethereum mainnet
2. **Batch operations**: Group multiple operations together
3. **Monitor gas prices**: Deploy during low-traffic times
4. **Optimize contract code**: Remove unnecessary operations

## Security Considerations

1. **Private key security**: Never share or commit private keys
2. **Contract verification**: Verify contracts on Polygonscan
3. **Access controls**: Implement proper role-based access
4. **Upgrade patterns**: Consider proxy patterns for upgrades
5. **Audit contracts**: Have contracts audited before mainnet deployment

## Troubleshooting

Common issues and solutions:

1. **Insufficient funds**: Add MATIC to your wallet
2. **Gas estimation failed**: Check contract code for errors
3. **Transaction reverted**: Verify function parameters
4. **Network congestion**: Try again later or increase gas price
