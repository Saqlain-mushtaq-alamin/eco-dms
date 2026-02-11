# Backend Integration Guide - EIP-712 Signing

This guide shows how to integrate EIP-712 signature generation in your Python/FastAPI backend for the verification system.

## 📋 Overview

The ML backend must:
1. Generate verdicts for eco-friendly posts
2. Sign verdicts using EIP-712 typed data signing
3. Return verdict + signature to the frontend
4. Store nonces to track used verdicts

## 📦 Installation

```bash
pip install eth-account web3
```

## 🔐 EIP-712 Signing in Python

### Setup

```python
from eth_account import Account
from eth_account.messages import encode_typed_data
import time
import secrets

# Load your verifier private key (store securely in .env)
VERIFIER_PRIVATE_KEY = "0x..."  # Your ML backend's private key
account = Account.from_key(VERIFIER_PRIVATE_KEY)
verifier_address = account.address

print(f"Verifier Address: {verifier_address}")
# ⚠️ Make sure this address is added as an authorized verifier in the contract!
```

### EIP-712 Domain and Types

```python
# Contract configuration
VERIFICATION_CONTRACT_ADDRESS = "0x..."  # Your deployed Verification contract
CHAIN_ID = 80002  # Polygon Mumbai (change for other networks)

# EIP-712 Domain
def get_eip712_domain():
    return {
        "name": "EcoDMS Verification",
        "version": "1",
        "chainId": CHAIN_ID,
        "verifyingContract": VERIFICATION_CONTRACT_ADDRESS,
    }

# EIP-712 Types
def get_eip712_types():
    return {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"},
        ],
        "Verdict": [
            {"name": "postCid", "type": "string"},
            {"name": "isEco", "type": "bool"},
            {"name": "confidence", "type": "uint256"},
            {"name": "timestamp", "type": "uint256"},
            {"name": "nonce", "type": "uint256"},
            {"name": "wallet", "type": "address"},
        ],
    }
```

### Generate and Sign Verdict

```python
def generate_nonce():
    """Generate a cryptographically secure random nonce"""
    return secrets.randbits(256)  # 256-bit random number

def sign_verdict(post_cid: str, is_eco: bool, confidence: float, wallet_address: str):
    """
    Sign a verdict with EIP-712
    
    Args:
        post_cid: IPFS CID of the post
        is_eco: True if post is eco-friendly
        confidence: Confidence score (0.0 to 1.0)
        wallet_address: User's wallet address to receive reward
    
    Returns:
        dict: Verdict data and signature
    """
    # Convert confidence to integer (0-100)
    confidence_int = int(confidence * 100)
    
    # Generate unique nonce
    nonce = generate_nonce()
    
    # Current timestamp
    timestamp = int(time.time())
    
    # Verdict data
    verdict = {
        "postCid": post_cid,
        "isEco": is_eco,
        "confidence": confidence_int,
        "timestamp": timestamp,
        "nonce": nonce,
        "wallet": wallet_address,
    }
    
    # Create EIP-712 typed data
    typed_data = {
        "types": get_eip712_types(),
        "primaryType": "Verdict",
        "domain": get_eip712_domain(),
        "message": verdict,
    }
    
    # Encode and sign
    encoded_data = encode_typed_data(full_message=typed_data)
    signed_message = account.sign_message(encoded_data)
    
    # Return verdict and signature
    return {
        "verdict": verdict,
        "signature": signed_message.signature.hex(),
        "signer": verifier_address,
    }
```

## 🔗 FastAPI Integration

### Database Models

```python
from pydantic import BaseModel
from typing import Optional

class Verdict(BaseModel):
    post_cid: str
    is_eco: bool
    confidence: int  # 0-100
    timestamp: int
    nonce: int
    wallet: str

class SignedVerdict(BaseModel):
    verdict: Verdict
    signature: str
    signer: str

# Store in database to track used verdicts
class VerdictRecord(BaseModel):
    id: int
    post_cid: str
    wallet: str
    is_eco: bool
    confidence: int
    nonce: int
    signature: str
    created_at: int
    claimed: bool = False  # Track if reward was claimed
```

### API Endpoint

```python
from fastapi import FastAPI, HTTPException
from typing import Dict

app = FastAPI()

# In-memory store for demo (use database in production)
used_nonces = set()
verified_posts = {}

@app.post("/api/verify/verdict")
async def create_verdict(
    post_cid: str,
    wallet_address: str,
    # ML model results
    eco_score: float,  # From your ML model
):
    """
    Generate and sign a verdict for a post
    
    This endpoint:
    1. Runs ML verification (your existing logic)
    2. Signs the verdict with EIP-712
    3. Returns verdict + signature to frontend
    """
    
    # Check if post already verified
    if post_cid in verified_posts:
        raise HTTPException(
            status_code=400,
            detail="Post already verified"
        )
    
    # Validate wallet address
    if not wallet_address.startswith("0x") or len(wallet_address) != 42:
        raise HTTPException(
            status_code=400,
            detail="Invalid wallet address"
        )
    
    # Determine if post is eco-friendly (your ML logic here)
    is_eco = eco_score >= 0.8
    confidence = eco_score
    
    if not is_eco:
        raise HTTPException(
            status_code=400,
            detail="Post is not eco-friendly (confidence too low)"
        )
    
    # Sign the verdict
    signed_verdict = sign_verdict(
        post_cid=post_cid,
        is_eco=is_eco,
        confidence=confidence,
        wallet_address=wallet_address,
    )
    
    # Store verdict (prevent reuse)
    verified_posts[post_cid] = signed_verdict
    used_nonces.add(signed_verdict["verdict"]["nonce"])
    
    # TODO: Save to database for persistence
    # db.save_verdict(signed_verdict)
    
    return signed_verdict


@app.get("/api/verify/verdict/{post_cid}")
async def get_verdict(post_cid: str):
    """
    Retrieve a previously generated verdict
    """
    if post_cid not in verified_posts:
        raise HTTPException(
            status_code=404,
            detail="Verdict not found"
        )
    
    return verified_posts[post_cid]


@app.post("/api/verify/claim")
async def mark_verdict_claimed(post_cid: str, tx_hash: str):
    """
    Mark a verdict as claimed after on-chain verification
    
    Called by frontend after successful transaction
    """
    if post_cid not in verified_posts:
        raise HTTPException(
            status_code=404,
            detail="Verdict not found"
        )
    
    # TODO: Update database
    # db.mark_claimed(post_cid, tx_hash)
    
    return {"success": True, "tx_hash": tx_hash}
```

## 🔄 Complete Flow

### 1. User Posts Content

```
User creates post → Frontend uploads to IPFS → Gets CID
```

### 2. Request Verification

```python
# Frontend calls backend
POST /api/verify/verdict
{
  "post_cid": "QmXxx...",
  "wallet_address": "0x123...",
  "eco_score": 0.85  # From ML model
}
```

### 3. Backend Signs Verdict

```python
# Backend response
{
  "verdict": {
    "postCid": "QmXxx...",
    "isEco": true,
    "confidence": 85,
    "timestamp": 1234567890,
    "nonce": 123456789012345678901234567890,
    "wallet": "0x123..."
  },
  "signature": "0xabcd...",
  "signer": "0x789..."  # Verifier address
}
```

### 4. Frontend Submits to Contract

```typescript
// Frontend submits to blockchain
const tx = await verificationContract.verifyAndReward(
  verdict,
  signature
);
await tx.wait();

// Notify backend of successful claim
await fetch('/api/verify/claim', {
  method: 'POST',
  body: JSON.stringify({
    post_cid: verdict.postCid,
    tx_hash: tx.hash
  })
});
```

## 🔒 Security Considerations

### 1. Private Key Management

```python
# ❌ NEVER do this
VERIFIER_PRIVATE_KEY = "0x123..."  # Hardcoded

# ✅ DO this
import os
from dotenv import load_dotenv

load_dotenv()
VERIFIER_PRIVATE_KEY = os.getenv("VERIFIER_PRIVATE_KEY")
```

### 2. Nonce Generation

```python
# ❌ NEVER do this
nonce = int(time.time())  # Predictable

# ✅ DO this
import secrets
nonce = secrets.randbits(256)  # Cryptographically secure
```

### 3. Store Verdicts

```python
# Store verdicts in database to:
# - Prevent generating duplicate verdicts for same post
# - Track which verdicts have been claimed
# - Audit trail for debugging
```

### 4. Rate Limiting

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

@app.post("/api/verify/verdict", dependencies=[RateLimiter(times=10, seconds=60)])
async def create_verdict(...):
    # Limit to 10 verdicts per minute per IP
    pass
```

## 🧪 Testing

### Test Signature Generation

```python
import pytest
from eth_account import Account
from eth_account.messages import encode_typed_data

def test_sign_verdict():
    """Test that verdict signing works correctly"""
    
    # Generate test verdict
    result = sign_verdict(
        post_cid="QmTest123",
        is_eco=True,
        confidence=0.85,
        wallet_address="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    )
    
    assert "verdict" in result
    assert "signature" in result
    assert result["verdict"]["isEco"] == True
    assert result["verdict"]["confidence"] == 85
    assert len(result["signature"]) == 132  # 0x + 130 chars
    
    # Verify signature recovers to correct address
    typed_data = {
        "types": get_eip712_types(),
        "primaryType": "Verdict",
        "domain": get_eip712_domain(),
        "message": result["verdict"],
    }
    
    encoded = encode_typed_data(full_message=typed_data)
    recovered = Account.recover_message(encoded, signature=result["signature"])
    
    assert recovered == verifier_address


def test_unique_nonces():
    """Ensure each verdict gets a unique nonce"""
    nonces = set()
    
    for i in range(100):
        result = sign_verdict(
            post_cid=f"QmTest{i}",
            is_eco=True,
            confidence=0.85,
            wallet_address="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        )
        nonce = result["verdict"]["nonce"]
        assert nonce not in nonces
        nonces.add(nonce)
```

## 📚 Environment Variables

Create a `.env` file:

```env
# Verifier Configuration
VERIFIER_PRIVATE_KEY=0x...  # Your ML backend private key
VERIFICATION_CONTRACT_ADDRESS=0x...  # Deployed Verification contract
CHAIN_ID=80002  # Network chain ID

# Database
DATABASE_URL=postgresql://...

# API
API_HOST=0.0.0.0
API_PORT=8000
```

## 🎯 Checklist

- [ ] Install `eth-account` and `web3` packages
- [ ] Generate verifier private key
- [ ] Add verifier address to smart contract (use admin-tools.ts)
- [ ] Configure EIP-712 domain with correct contract address
- [ ] Implement verdict signing in backend
- [ ] Store verdicts in database
- [ ] Implement API endpoints
- [ ] Add rate limiting
- [ ] Test signature generation
- [ ] Test end-to-end flow with frontend
- [ ] Monitor for errors in production

## 🔗 Next Steps

1. Deploy smart contracts (see [README_VERIFICATION.md](./README_VERIFICATION.md))
2. Add verifier address as authorized in Verification contract
3. Implement verdict signing in your ML backend
4. Update frontend to submit verdicts to blockchain
5. Configure The Graph subgraph to index events

## 📞 Support

If signature verification fails:
- Check that domain chainId matches network
- Verify contract address is correct
- Ensure verifier address is authorized in contract
- Check that all verdict fields match exactly (spelling, types)
- Use `getDigest()` contract function to compare hashes
