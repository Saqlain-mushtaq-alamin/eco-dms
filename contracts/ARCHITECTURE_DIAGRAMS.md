# Verification System Architecture

## System Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant MLModel
    participant Verification
    participant RewardToken
    participant TheGraph

    User->>Frontend: Create eco-friendly post
    Frontend->>Backend: Upload post + request verification
    Backend->>MLModel: Analyze post content
    MLModel-->>Backend: Return eco score (0.85)
    
    Note over Backend: Check if eco (≥0.8)
    Backend->>Backend: Generate verdict
    Backend->>Backend: Sign verdict (EIP-712)
    Backend-->>Frontend: Return verdict + signature
    
    Frontend->>Frontend: Display "Claim 5 ECO" button
    User->>Frontend: Click "Claim Reward"
    Frontend->>Verification: verifyAndReward(verdict, signature)
    
    Note over Verification: 1. Verify signature
    Verification->>Verification: Recover signer from signature
    Verification->>Verification: Check if signer authorized
    
    Note over Verification: 2. Validate rules
    Verification->>Verification: is_eco == true?
    Verification->>Verification: confidence >= 80?
    Verification->>Verification: timestamp not expired?
    Verification->>Verification: nonce not used?
    
    Note over Verification: 3. Anti-spam checks
    Verification->>Verification: Post CID already rewarded?
    Verification->>Verification: Wallet in cooldown?
    
    Note over Verification: 4. All checks passed ✅
    Verification->>RewardToken: mint(user, 5 ECO)
    RewardToken-->>User: Transfer 5 ECO tokens
    
    Verification->>TheGraph: Emit PostVerified event
    Verification->>TheGraph: Emit RewardMinted event
    
    Frontend-->>User: Success! You received 5 ECO 🎉
```

## Contract Architecture

```mermaid
classDiagram
    class RewardToken {
        +string name: "EcoDMS Reward Token"
        +string symbol: "ECO"
        +mapping minters
        +addMinter(address)
        +removeMinter(address)
        +mint(address, uint256)
        +isMinter(address) bool
    }
    
    class Verification {
        +uint256 REWARD_AMOUNT: 5 ECO
        +uint256 MIN_CONFIDENCE: 80
        +uint256 COOLDOWN_PERIOD: 24h
        +mapping authorizedVerifiers
        +mapping usedNonces
        +mapping rewardedPosts
        +mapping lastRewardTime
        +addVerifier(address)
        +removeVerifier(address)
        +verifyAndReward(Verdict, signature)
        +getDomainSeparator() bytes32
        +isPostRewarded(string) bool
        +getCooldownRemaining(address) uint256
    }
    
    class Verdict {
        +string postCid
        +bool isEco
        +uint256 confidence
        +uint256 timestamp
        +uint256 nonce
        +address wallet
    }
    
    Verification --> RewardToken: mints tokens
    Verification ..> Verdict: verifies
```

## Data Flow

```mermaid
flowchart TD
    A[User Creates Post] --> B[Post Uploaded to IPFS]
    B --> C[ML Model Analyzes]
    C --> D{Eco-Friendly?}
    D -->|No| E[Reject - Not Eco]
    D -->|Yes| F{Confidence >= 80%?}
    F -->|No| G[Reject - Low Confidence]
    F -->|Yes| H[Backend Signs Verdict]
    H --> I[Frontend Receives Verdict + Signature]
    I --> J[User Clicks Claim]
    J --> K[Submit to Blockchain]
    
    K --> L{Signature Valid?}
    L -->|No| M[Reject - Bad Signature]
    L -->|Yes| N{Verdict Rules OK?}
    N -->|No| O[Reject - Invalid Rules]
    N -->|Yes| P{Nonce Used?}
    P -->|Yes| Q[Reject - Replay Attack]
    P -->|No| R{Post Already Rewarded?}
    R -->|Yes| S[Reject - Duplicate Post]
    R -->|No| T{Wallet in Cooldown?}
    T -->|Yes| U[Reject - Wait 24h]
    T -->|No| V[Mint 5 ECO Tokens]
    
    V --> W[Emit PostVerified Event]
    V --> X[Emit RewardMinted Event]
    W --> Y[The Graph Indexes]
    X --> Y
    V --> Z[User Receives Tokens 🎉]
```

## Security Layers

```mermaid
flowchart LR
    A[Verdict Submission] --> B[Layer 1: Signature Verification]
    B --> C{Valid EIP-712 Signature?}
    C -->|No| D[❌ Reject]
    C -->|Yes| E[Layer 2: Authorization Check]
    E --> F{Signer Authorized?}
    F -->|No| D
    F -->|Yes| G[Layer 3: Verdict Rules]
    G --> H{All Rules Pass?}
    H -->|No| D
    H -->|Yes| I[Layer 4: Replay Protection]
    I --> J{Nonce Unused?}
    J -->|No| D
    J -->|Yes| K[Layer 5: Anti-Spam]
    K --> L{Post & Wallet OK?}
    L -->|No| D
    L -->|Yes| M[✅ Mint Reward]
```

## EIP-712 Signing Process

```mermaid
flowchart TD
    A[Verdict Data] --> B[Hash struct data]
    B --> C[Combine with domain separator]
    C --> D[Create typed data hash]
    D --> E[Sign with verifier private key]
    E --> F[Generate signature]
    F --> G[Send to frontend]
    
    G --> H[Frontend submits to contract]
    H --> I[Contract recovers signer]
    I --> J{Signer matches authorized verifier?}
    J -->|Yes| K[✅ Accept]
    J -->|No| L[❌ Reject]
    
    style A fill:#e1f5ff
    style F fill:#d4edda
    style K fill:#d4edda
    style L fill:#f8d7da
```

## Component Interaction

```mermaid
graph TB
    subgraph "Frontend (React)"
        A[User Interface]
        B[Wallet Connection]
        C[Contract Interaction]
    end
    
    subgraph "Backend (Python/FastAPI)"
        D[API Endpoints]
        E[ML Model]
        F[EIP-712 Signer]
    end
    
    subgraph "Blockchain"
        G[RewardToken Contract]
        H[Verification Contract]
    end
    
    subgraph "Indexing"
        I[The Graph]
        J[Event Listeners]
    end
    
    A --> B
    B --> C
    A --> D
    D --> E
    E --> F
    F --> D
    D --> A
    C --> H
    H --> G
    H --> J
    J --> I
    
    style A fill:#e3f2fd
    style D fill:#fff3e0
    style G fill:#f3e5f5
    style H fill:#f3e5f5
    style I fill:#e8f5e9
```

## State Management

```mermaid
stateDiagram-v2
    [*] --> PostCreated: User creates post
    PostCreated --> MLAnalysis: Send to ML model
    MLAnalysis --> VerdictSigned: Eco-friendly (≥80%)
    MLAnalysis --> Rejected: Not eco-friendly
    VerdictSigned --> PendingClaim: Signature returned
    PendingClaim --> Validating: User clicks claim
    Validating --> Cooldown: Wallet in cooldown
    Validating --> AlreadyRewarded: Post already rewarded
    Validating --> NonceUsed: Nonce already used
    Validating --> Success: All checks pass
    Success --> [*]: 5 ECO minted
    Cooldown --> PendingClaim: Wait 24h
    Rejected --> [*]
    AlreadyRewarded --> [*]
    NonceUsed --> [*]
```

## Key Metrics to Track

```mermaid
pie title Verdict Outcomes
    "Successful Claims" : 100
    "Cooldown Rejections" : 30
    "Duplicate Posts" : 20
    "Low Confidence" : 15
    "Invalid Signatures" : 5
    "Replay Attacks" : 2
```

---

*These diagrams illustrate the complete architecture of the EcoDMS verification and reward system.*
