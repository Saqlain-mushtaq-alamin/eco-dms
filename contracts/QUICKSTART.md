# ⚡ Quick Start - Verification System

## 🚀 Get Running in 5 Minutes

### 1. Install & Build
```bash
cd contracts
npm install
npm run build
```

### 2. Run Tests (Optional)
```bash
npm run test:verification
# Expected: 47 passing tests ✅
```

### 3. Deploy Locally
```bash
# Terminal 1: Start local blockchain
npm run node

# Terminal 2: Deploy contracts
npm run deploy:verification
```

**Save the contract addresses!** You'll see output like:
```
✅ RewardToken deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ Verification deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 4. Add Your ML Backend asVerifier

**Option A: Using admin tools (recommended)**
```bash
npm run admin
# Select option 1: Add Verifier
# Enter your ML backend address
```

**Option B: Using hardhat console**
```bash
npx hardhat console --network localhost

# In console:
const Verification = await ethers.getContractFactory("Verification");
const verification = Verification.attach("0xYOUR_VERIFICATION_ADDRESS");
await verification.addVerifier("0xYOUR_ML_BACKEND_ADDRESS");
```

### 5. Backend Integration (Python)

**Install dependencies:**
```bash
pip install eth-account web3
```

**Sign a verdict:**
```python
from eth_account import Account
from eth_account.messages import encode_typed_data
import time
import secrets

# Your ML backend's private key
VERIFIER_PRIVATE_KEY = "0x..."
account = Account.from_key(VERIFIER_PRIVATE_KEY)

# EIP-712 domain
domain = {
    "name": "EcoDMS Verification",
    "version": "1",
    "chainId": 31337,  # Local hardhat network
    "verifyingContract": "0xYOUR_VERIFICATION_CONTRACT",
}

# Types
types = {
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

# Create verdict
verdict = {
    "postCid": "QmTest123456",
    "isEco": True,
    "confidence": 85,  # 85%
    "timestamp": int(time.time()),
    "nonce": secrets.randbits(256),
    "wallet": "0xUSER_WALLET_ADDRESS",
}

# Sign
typed_data = {
    "types": types,
    "primaryType": "Verdict",
    "domain": domain,
    "message": verdict,
}

encoded = encode_typed_data(full_message=typed_data)
signed = account.sign_message(encoded)

print(f"Signature: {signed.signature.hex()}")
# Return verdict + signature to frontend
```

### 6. Frontend Integration (React/TypeScript)

**Install dependencies:**
```bash
cd ../apps/web
npm install ethers@6
```

**Claim reward:**
```typescript
import { ethers } from 'ethers';

// Connect to contract
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const verification = new ethers.Contract(
  "0xYOUR_VERIFICATION_CONTRACT",
  VerificationABI,
  signer
);

// Submit verdict from backend
const tx = await verification.verifyAndReward(verdict, signature);
const receipt = await tx.wait();

console.log("Reward claimed! 🎉", receipt.hash);
// User received 5 ECO tokens
```

## 🧪 Test the Full Flow

### 1. Create Test Accounts

In hardhat console:
```javascript
const [owner, verifier, user1] = await ethers.getSigners();
console.log("Owner:", owner.address);
console.log("Verifier:", verifier.address);
console.log("User:", user1.address);
```

### 2. Test Verdict and Reward

```javascript
// Get contracts
const RewardToken = await ethers.getContractFactory("RewardToken");
const Verification = await ethers.getContractFactory("Verification");

const token = RewardToken.attach("0xTOKEN_ADDRESS");
const verification = Verification.attach("0xVERIFICATION_ADDRESS");

// Add verifier
await verification.addVerifier(verifier.address);

// Create and sign verdict
const domain = {
  name: "EcoDMS Verification",
  version: "1",
  chainId: 31337,
  verifyingContract: await verification.getAddress(),
};

const types = {
  Verdict: [
    { name: "postCid", type: "string" },
    { name: "isEco", type: "bool" },
    { name: "confidence", type: "uint256" },
    { name: "timestamp", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "wallet", type: "address" },
  ],
};

const verdict = {
  postCid: "QmTest123",
  isEco: true,
  confidence: 85,
  timestamp: Math.floor(Date.now() / 1000),
  nonce: 1,
  wallet: user1.address,
};

const signature = await verifier.signTypedData(domain, types, verdict);

// Submit and claim reward
const tx = await verification.verifyAndReward(verdict, signature);
await tx.wait();

// Check balance
const balance = await token.balanceOf(user1.address);
console.log("User balance:", ethers.formatEther(balance), "ECO");
// Expected: 5.0 ECO
```

## 📊 Monitor Activity

### Check if post was rewarded:
```javascript
const isRewarded = await verification.isPostRewarded("QmTest123");
console.log("Post rewarded:", isRewarded);
```

### Check wallet cooldown:
```javascript
const cooldown = await verification.getCooldownRemaining(user1.address);
const hours = Number(cooldown) / 3600;
console.log("Cooldown remaining:", hours.toFixed(2), "hours");
```

### Check token balance:
```javascript
const balance = await token.balanceOf(user1.address);
console.log("Balance:", ethers.formatEther(balance), "ECO");
```

## 🌐 Deploy to Testnet

### Sepolia

1. **Get test ETH**: https://sepoliafaucet.com/
2. **Configure `.env`:**
   ```env
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
   SEPOLIA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
   ```
3. **Deploy:**
   ```bash
   npm run deploy:verification:sepolia
   ```

### Polygon Mumbai

1. **Get test MATIC**: https://faucet.polygon.technology/
2. **Configure `.env`:**
   ```env
   MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_KEY
   DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
   ```
3. **Deploy:**
   ```bash
   npm run deploy:verification:staging
   ```

## ✅ Checklist

- [ ] Contracts deployed
- [ ] ML backend address added as verifier
- [ ] Backend can sign verdicts (Python)
- [ ] Frontend can submit verdicts (React)
- [ ] Test full flow: post → verify → claim → receive tokens
- [ ] Monitor events for The Graph integration

## 🎯 What You Have

✅ **RewardToken** - 5 ECO tokens per verified post
✅ **Verification** - EIP-712 signature verification
✅ **Anti-spam** - Cooldown + duplicate prevention
✅ **47 passing tests** - Comprehensive coverage
✅ **Complete documentation** - Backend and frontend guides

## 🔗 Documentation

- Full system docs: [README_VERIFICATION.md](./README_VERIFICATION.md)
- Python guide: [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md)
- React guide: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)
- Complete summary: [PHASE4_COMPLETE.md](./PHASE4_COMPLETE.md)

## 💡 Pro Tips

1. **Use admin tools** for easy contract management: `npm run admin`
2. **Test locally first** before deploying to testnet
3. **Save contract addresses** immediately after deployment
4. **Monitor gas costs** on testnet before mainnet
5. **Use The Graph** for historical verification data

## 🚨 Common Gotchas

- **"Signer not authorized"** → Add verifier address first
- **"Cooldown period"** → Wait 24 hours between rewards per wallet
- **"Post already rewarded"** → Each post CID can only be rewarded once
- **"Verdict expired"** → Verdicts valid for 1 hour only

---

**Ready to go!** 🚀

Run `npm run deploy:verification` and start rewarding eco-friendly posts!
