// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * Simple Authentication Contract for Academic Vault
 * Records authentication events on blockchain
 */
contract SimpleAuthContract {
    struct AuthEvent {
        string encryptedData;
        uint256 timestamp;
        address submitter;
        bool verified;
    }
    
    mapping(bytes32 => AuthEvent) public authEvents;
    mapping(address => uint256) public authCounts;
    
    event AuthEventRecorded(bytes32 indexed eventHash, address indexed submitter, uint256 timestamp);
    
    function recordAuthEvent(string memory encryptedData, uint256 timestamp) 
        public 
        returns (bytes32) 
    {
        bytes32 eventHash = keccak256(abi.encodePacked(encryptedData, timestamp, msg.sender, block.timestamp));
        
        authEvents[eventHash] = AuthEvent({
            encryptedData: encryptedData,
            timestamp: timestamp,
            submitter: msg.sender,
            verified: true
        });
        
        authCounts[msg.sender]++;
        
        emit AuthEventRecorded(eventHash, msg.sender, timestamp);
        
        return eventHash;
    }
    
    function verifyAuthEvent(bytes32 eventHash) 
        public 
        view 
        returns (bool verified, uint256 timestamp) 
    {
        AuthEvent memory authEvent = authEvents[eventHash];
        return (authEvent.verified, authEvent.timestamp);
    }
    
    function getAuthCount(address user) public view returns (uint256) {
        return authCounts[user];
    }
}

/**
 * Simple Verification Contract for Academic Vault
 * Records and verifies document hashes on blockchain
 */
contract SimpleVerificationContract {
    struct Document {
        string documentHash;
        string metadata;
        uint256 timestamp;
        address institution;
        bool isActive;
    }
    
    mapping(string => Document) public documents;
    mapping(address => uint256) public documentCounts;
    
    event DocumentRecorded(string indexed documentHash, address indexed institution, uint256 timestamp);
    event DocumentRevoked(string indexed documentHash, address indexed institution);
    
    function recordDocument(string memory documentHash, string memory metadata) 
        public 
        returns (bytes32) 
    {
        require(bytes(documentHash).length > 0, "Document hash cannot be empty");
        require(!documents[documentHash].isActive, "Document already exists");
        
        documents[documentHash] = Document({
            documentHash: documentHash,
            metadata: metadata,
            timestamp: block.timestamp,
            institution: msg.sender,
            isActive: true
        });
        
        documentCounts[msg.sender]++;
        
        emit DocumentRecorded(documentHash, msg.sender, block.timestamp);
        
        return keccak256(abi.encodePacked(documentHash, msg.sender, block.timestamp));
    }
    
    function verifyDocument(string memory documentHash) 
        public 
        view 
        returns (bool valid, uint256 timestamp, address institution) 
    {
        Document memory doc = documents[documentHash];
        return (doc.isActive, doc.timestamp, doc.institution);
    }
    
    function getDocumentDetails(string memory documentHash) 
        public 
        view 
        returns (string memory metadata, uint256 timestamp, address institution, bool isActive) 
    {
        Document memory doc = documents[documentHash];
        return (doc.metadata, doc.timestamp, doc.institution, doc.isActive);
    }
    
    function revokeDocument(string memory documentHash) 
        public 
        returns (bool) 
    {
        require(documents[documentHash].institution == msg.sender, "Only institution can revoke");
        require(documents[documentHash].isActive, "Document not active");
        
        documents[documentHash].isActive = false;
        
        emit DocumentRevoked(documentHash, msg.sender);
        
        return true;
    }
    
    function getInstitutionDocumentCount(address institution) public view returns (uint256) {
        return documentCounts[institution];
    }
}

/**
 * Simple Audit Contract for Academic Vault
 * Records audit batches with Merkle roots for integrity
 */
contract SimpleAuditContract {
    struct AuditBatch {
        string merkleRoot;
        uint256 timestamp;
        string metadata;
        address submitter;
        uint256 eventCount;
    }
    
    mapping(bytes32 => AuditBatch) public auditBatches;
    mapping(address => uint256) public batchCounts;
    
    event AuditBatchRecorded(bytes32 indexed batchId, string merkleRoot, uint256 timestamp, uint256 eventCount);
    
    function recordAuditBatch(string memory merkleRoot, uint256 timestamp, string memory metadata) 
        public 
        returns (bytes32) 
    {
        require(bytes(merkleRoot).length > 0, "Merkle root cannot be empty");
        
        bytes32 batchId = keccak256(abi.encodePacked(merkleRoot, timestamp, msg.sender, block.timestamp));
        
        // Parse event count from metadata (simple implementation)
        uint256 eventCount = 1; // Default to 1 if parsing fails
        
        auditBatches[batchId] = AuditBatch({
            merkleRoot: merkleRoot,
            timestamp: timestamp,
            metadata: metadata,
            submitter: msg.sender,
            eventCount: eventCount
        });
        
        batchCounts[msg.sender]++;
        
        emit AuditBatchRecorded(batchId, merkleRoot, timestamp, eventCount);
        
        return batchId;
    }
    
    function getAuditBatch(bytes32 batchId) 
        public 
        view 
        returns (string memory merkleRoot, uint256 timestamp, string memory metadata, address submitter) 
    {
        AuditBatch memory batch = auditBatches[batchId];
        return (batch.merkleRoot, batch.timestamp, batch.metadata, batch.submitter);
    }
    
    function verifyAuditEntry(
        string memory entryHash, 
        string[] memory proof, 
        string memory merkleRoot
    ) 
        public 
        pure 
        returns (bool) 
    {
        // Simple Merkle proof verification
        // In production, implement full Merkle tree verification
        bytes32 computedHash = keccak256(abi.encodePacked(entryHash));
        
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = keccak256(abi.encodePacked(proof[i]));
            computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
        }
        
        return keccak256(abi.encodePacked(computedHash)) == keccak256(abi.encodePacked(merkleRoot));
    }
    
    function getInstitutionBatchCount(address institution) public view returns (uint256) {
        return batchCounts[institution];
    }
}
