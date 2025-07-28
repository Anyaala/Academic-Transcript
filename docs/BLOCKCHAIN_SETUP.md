# Blockchain Security System Setup Guide

This document provides instructions for setting up and configuring the enhanced blockchain security system for the Verifiable Academic Vault.

## Overview

The blockchain security system provides:
- **Authentication Security**: Blockchain-secured user authentication with immutable audit logs
- **Document Verification**: Cryptographically signed transcript verification on blockchain
- **Audit Logging**: Immutable audit trail with Merkle tree batching
- **Smart Contracts**: Ethereum/Polygon integration for document integrity

## Architecture Components

### 1. Edge Functions
- `blockchain-auth`: Handles authentication events and token signing
- `blockchain-verify`: Document and transaction verification
- `blockchain-audit`: Immutable audit log management
- `blockchain-transcript`: Enhanced transcript processing (existing)

### 2. Database Schema
- `audit_logs`: Comprehensive security event logging
- `audit_batches`: Blockchain batch processing records
- `verification_logs`: Document verification tracking
- `blockchain_config`: Network configuration management
- `auth_tokens`: Blockchain-secured authentication tokens

### 3. Frontend Integration
- `useBlockchainAuth`: React hook for blockchain authentication
- Enhanced `useAuth`: Integrated blockchain logging
- Updated verification components

## Configuration

### Environment Variables

Add these environment variables to your Supabase project:

```bash
# Required for production blockchain integration
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BLOCKCHAIN_PRIVATE_KEY=your_wallet_private_key_here
BLOCKCHAIN_SECRET_KEY=your_encryption_secret_key_here

# Contract addresses (deploy your own or use provided addresses)
AUTH_CONTRACT_ADDRESS=0x...
VERIFICATION_CONTRACT_ADDRESS=0x...
AUDIT_CONTRACT_ADDRESS=0x...

# API Keys
ALCHEMY_API_KEY=your_alchemy_api_key
INFURA_PROJECT_ID=your_infura_project_id
```

### Database Migration

Run the blockchain security migration:

```sql
-- Apply the migration
\i supabase/migrations/20250724150000_blockchain_security_system.sql
```

### Smart Contracts

The system is designed to work with custom smart contracts. Example contracts:

#### Authentication Contract
```solidity
contract AuthenticationContract {
    function recordAuthEvent(string memory encryptedData, uint256 timestamp) 
        public returns (bytes32);
    function verifyAuthEvent(bytes32 eventHash) 
        public view returns (bool, uint256);
}
```

#### Verification Contract
```solidity
contract VerificationContract {
    function verifyDocument(string memory documentHash) 
        public view returns (bool, uint256, address);
    function recordDocument(string memory documentHash, string memory metadata) 
        public returns (bytes32);
}
```

## Development vs Production

### Development Mode (Default)
- Uses simulated blockchain transactions
- No real blockchain network required
- All features work in simulation mode
- Realistic transaction hashes generated

### Production Mode
- Requires real blockchain network configuration
- Uses actual smart contracts
- Real transaction costs apply
- Full cryptographic security

## Security Features

### 1. Enhanced Encryption
- AES-GCM encryption with 256-bit keys
- PBKDF2 key derivation (150,000+ iterations)
- Random IV for each encryption
- Replay attack protection with timestamps and salts

### 2. Digital Signatures
- HMAC-SHA256 digital signatures
- Token-based authentication
- Blockchain-verifiable signatures
- Expiring tokens with automatic cleanup

### 3. Audit Chain
- Merkle tree structure for batch integrity
- Blockchain anchoring of audit batches
- Immutable audit trail
- Cryptographic proof of log integrity

### 4. Rate Limiting
- IP-based rate limiting for verification
- Configurable limits per endpoint
- DDoS protection
- Abuse prevention

## Usage

### Basic Authentication Logging
```typescript
import { useBlockchainAuth } from '@/hooks/useBlockchainAuth'

const { logAuditEvent } = useBlockchainAuth()

// Log security events
await logAuditEvent({
  action: 'user_login',
  resourceType: 'auth',
  resourceId: userId,
  details: { method: 'password' },
  severity: 'low'
})
```

### Document Verification
```typescript
const { verifyDocument } = useBlockchainAuth()

// Verify by ID
const result = await verifyDocument({
  action: 'verify_id',
  verificationId: 'VT-123456789-ABCDEF'
})

// Verify by hash
const result = await verifyDocument({
  action: 'verify_hash',
  fileHash: 'sha256_hash_here'
})
```

### Batch Audit Processing
```typescript
const { processAuditBatch } = useBlockchainAuth()

// Process pending audit logs to blockchain
const success = await processAuditBatch()
```

## Monitoring and Maintenance

### Audit Log Monitoring
```sql
-- View recent security events
SELECT * FROM audit_logs 
WHERE severity IN ('high', 'critical') 
ORDER BY created_at DESC 
LIMIT 50;

-- Check blockchain integration status
SELECT 
  blockchain_tx IS NOT NULL as has_blockchain_tx,
  COUNT(*) as count
FROM audit_logs 
GROUP BY blockchain_tx IS NOT NULL;
```

### Token Cleanup
```sql
-- Clean up expired tokens (run daily)
SELECT cleanup_expired_tokens();
```

### Batch Processing Status
```sql
-- Check audit batch processing
SELECT 
  event_count,
  created_at,
  blockchain_tx IS NOT NULL as on_blockchain
FROM audit_batches 
ORDER BY created_at DESC 
LIMIT 10;
```

## Troubleshooting

### Common Issues

1. **Blockchain not connecting**
   - Check RPC URL and API keys
   - Verify network connectivity
   - System falls back to simulation mode

2. **Authentication failing**
   - Check private key format
   - Verify contract addresses
   - Review rate limiting settings

3. **Slow verification**
   - Check blockchain network status
   - Consider using faster RPC endpoints
   - Implement caching if needed

### Error Codes
- `BLOCKCHAIN_NOT_CONFIGURED`: Missing environment variables
- `INVALID_SIGNATURE`: Authentication signature verification failed
- `RATE_LIMITED`: Too many requests from IP
- `CONTRACT_ERROR`: Smart contract interaction failed

## Production Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migration applied
- [ ] Smart contracts deployed
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Backup procedures in place
- [ ] Security audit completed

## Security Considerations

1. **Private Key Management**: Store private keys securely, use key management services
2. **Rate Limiting**: Configure appropriate limits for your use case
3. **Gas Costs**: Monitor and budget for blockchain transaction costs
4. **Network Selection**: Choose appropriate blockchain network for your needs
5. **Data Privacy**: Ensure sensitive data is properly encrypted before blockchain storage

## Support

For technical support or questions about the blockchain security system:
1. Check the error logs in Supabase
2. Review the audit logs for security events
3. Monitor blockchain transaction status
4. Contact the development team with specific error messages

## Version History

- **v1.0** (2024-07-24): Initial blockchain security system implementation
  - Authentication logging
  - Document verification
  - Audit batching
  - Smart contract integration
