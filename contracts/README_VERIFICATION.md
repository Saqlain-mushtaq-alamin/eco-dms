# Phase 4: Smart Contracts - Verification + Rewards

This directory contains the smart contract implementation for the EcoDMS verification and reward system.

## 📋 Overview

The system consists of two main contracts:

1. **RewardToken.sol** - ERC-20 token for rewarding verified eco-friendly posts
2. **Verification.sol** - Verifies ML verdicts with EIP-712 signatures and mints rewards

## 🎯 Features

### RewardToken (ECO)
- ERC-20 compliant token
- Controlled minting (only authorized minters can mint)
- Owner can add/remove minters
- Fixed reward amount: **5 ECO tokens** per verified post

### Verification Contract
- ✅ **EIP-712 Signature Verification** - Secure typed data signing
- ✅ **Authorized Verifier Registry** - Owner can add/remove ML backend addresses
- ✅ **Verdict Rules Validation**:
  - `is_eco == true`
  - `confidence >= 80` (0.8)
  - `timestamp` not expired (max 1 hour old)
  - `nonce` not used before
- ✅ **Anti-Spam Protection**:
  - One reward per post CID
  - One reward per wallet per 24 hours
  - Replay protection via nonces
- ✅ **Events for The Graph**:
  - `PostVerified` - Emitted when a post is verified
  - `RewardMinted` - Emitted when tokens are minted

## 📦 Installation

```bash
cd contracts
npm install
```

This will install:
- Hardhat and toolbox
- OpenZeppelin contracts
- Ethers v6
- TypeScript dependencies

## 🧪 Testing

Run all tests:
```bash
npm test
```

Run verification tests only:
```bash
npm run test:verification
```

Generate coverage report:
```bash
npm run test:coverage
```

### Test Coverage

The test suite covers:
- ✅ RewardToken deployment and configuration
- ✅ Minter management (add/remove)
- ✅ Token minting with access control
- ✅ Verification deployment and configuration
- ✅ Verifier management (add/remove)
- ✅ Valid verdict verification and rewards
- ✅ Signature validation (EIP-712)
- ✅ Verdict rules validation
- ✅ Replay protection
- ✅ Anti-spam (post CID)
- ✅ Cooldown period enforcement
- ✅ Edge cases and multiple users

## 🚀 Deployment

### Local (Hardhat Network)

1. Start local node:
```bash
npm run node
```

2. Deploy (in another terminal):
```bash
npm run deploy:verification
```

### Testnet (Sepolia)

1. Configure `.env`:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
SEPOLIA_PRIVATE_KEY=your_private_key_here
```

2. Deploy:
```bash
npm run deploy:verification:sepolia
```

### Polygon Mumbai

```bash
npm run deploy:verification:staging
```

## 🔧 Admin Tools

Interactive CLI for contract management:

```bash
npm run admin
```

Features:
- Add/remove verifiers
- Check verifier status
- Check token balances
- Check post reward status
- Check wallet cooldown
- View contract information

## 📝 Contract Architecture

### Data Flow

```
ML Backend (Python)
    ↓ Signs verdict with EIP-712
    ↓
Frontend (React)
    ↓ Submits verdict + signature
    ↓
Verification Contract
    ↓ Verifies signature
    ↓ Validates rules
    ↓ Checks anti-spam
    ↓
RewardToken Contract
    ↓ Mints 5 ECO tokens
    ↓
User Wallet 🎉
```

### Verdict Structure (EIP-712)

```typescript
struct Verdict {
  string postCid;        // IPFS CID of the post
  bool isEco;            // True if eco-friendly
  uint256 confidence;    // Confidence score (0-100)
  uint256 timestamp;     // Timestamp of verdict
  uint256 nonce;         // Unique nonce for replay protection
  address wallet;        // Wallet to reward
}
```

### EIP-712 Domain

```typescript
{
  name: "EcoDMS Verification",
  version: "1",
  chainId: <network_chain_id>,
  verifyingContract: <verification_contract_address>
}
```

## 🔐 Security Features

1. **Signature Verification (EIP-712)**
   - Prevents signature reuse across different contracts
   - Prevents signature reuse across different chains
   - Type-safe signing with domain separation

2. **Authorized Verifiers**
   - Only owner can add/remove verifiers
   - Only authorized verifiers can sign valid verdicts

3. **Replay Protection**
   - Nonces tracked on-chain
   - Each nonce can only be used once

4. **Anti-Spam**
   - One reward per post CID (permanent)
   - One reward per wallet per 24 hours (cooldown)

5. **Verdict Expiration**
   - Verdicts expire after 1 hour
   - Prevents stale verdicts from being used

## 🔗 Integration Guide

### Backend (Python/FastAPI)

See [Backend Integration Guide](./BACKEND_INTEGRATION.md) for Python code examples.

Key steps:
1. Generate EIP-712 signature for verdicts
2. Store signature with verdict in database
3. Return verdict + signature to frontend

### Frontend (React/ethers)

```typescript
import { ethers } from 'ethers';

// Connect to contract
const verification = new ethers.Contract(
  VERIFICATION_ADDRESS,
  VerificationABI,
  provider
);

// Submit verdict
const tx = await verification.verifyAndReward(verdict, signature);
await tx.wait();
```

### The Graph (Subgraph)

Configure event handlers for:
- `PostVerified` - Track verified posts
- `RewardMinted` - Track reward distributions
- `VerifierAdded`/`VerifierRemoved` - Track verifier changes

## 📊 Constants

```solidity
REWARD_AMOUNT = 5 * 10^18 (5 ECO tokens)
MIN_CONFIDENCE = 80 (80%)
COOLDOWN_PERIOD = 24 hours
VERDICT_EXPIRY = 1 hour
```

## 🎯 Acceptance Criteria

- ✅ Contract verifies EIP-712 signatures from authorized signers
- ✅ Mints 5 ECO tokens for valid eco-friendly posts
- ✅ Prevents replay attacks via nonce tracking
- ✅ Prevents spam via post CID and wallet cooldown
- ✅ Emits structured events for The Graph indexing
- ✅ All tests pass with comprehensive coverage
- ✅ Edge cases handled: bad signature, low confidence, rate limits

## 📚 Additional Resources

- [OpenZeppelin ERC20](https://docs.openzeppelin.com/contracts/4.x/erc20)
- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers v6 Documentation](https://docs.ethers.org/v6/)

## 🐛 Troubleshooting

### "Verification: signer not authorized"
- Make sure the ML backend address is added as an authorized verifier
- Use `admin-tools.ts` to add the verifier address

### "Verification: wallet in cooldown period"
- Users can only receive one reward per 24 hours
- Check remaining cooldown with `getCooldownRemaining(wallet)`

### "Verification: post already rewarded"
- Each post CID can only be rewarded once
- This prevents duplicate rewards for the same content

### "Verification: nonce already used"
- Each nonce can only be used once (replay protection)
- Generate a new nonce for each verdict

### Tests failing to compile
- Run `npm install` to ensure OpenZeppelin contracts are installed
- Run `npm run build` to compile contracts

## 📄 License

MIT
