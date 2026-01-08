# 🤖 ML Eco Verifier - Decentralized Verification System

## Overview

The ML Eco Verifier is a **fully decentralized** system that uses machine learning to verify if social media posts are eco-friendly. All verification results are cryptographically signed and stored on IPFS, maintaining the decentralized nature of your platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Posts Content                       │
│                    (Image + Text → IPFS)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   ML Verification Pipeline                   │
│  ┌────────────┬─────────────┬──────────────────────────┐    │
│  │  YOLOv8    │    CLIP     │    EfficientNet         │    │
│  │  Object    │  Image-Text │    Classification        │    │
│  │  Detection │  Alignment  │                          │    │
│  └────────────┴─────────────┴──────────────────────────┘    │
│                              ↓                               │
│              Eco Scorer (Logic Engine)                       │
│              Confidence: 0.0 → 1.0                          │
│              Verdict: eco if > 0.8                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Cryptographic Signer                        │
│  • Signs verdict with private key                           │
│  • Adds nonce + timestamp (anti-replay)                     │
│  • Verifiable signature                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 IPFS Storage (Decentralized)                │
│  • Signed verdict stored as JSON                            │
│  • Pinned for availability                                  │
│  • CID returned for verification                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    OrbitDB Post Metadata                     │
│  {                                                           │
│    "content_cid": "Qm...",                                  │
│    "verified": true,                                        │
│    "eco_score": 0.87,                                       │
│    "signed_verdict_cid": "Qm...",  ← Verifiable!           │
│    "verifier_address": "0x..."                              │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

## Features

✅ **Fully Decentralized** - All verdicts stored on IPFS  
✅ **Cryptographically Signed** - Anti-tamper, verifiable  
✅ **Multi-Model ML** - YOLOv8 + CLIP + EfficientNet  
✅ **Async Processing** - Celery workers for scalability  
✅ **No Gas Fees** - All verification is FREE!  
✅ **Auditable** - Anyone can verify signatures  

## ML Models

### 1. YOLOv8 Object Detection (40% weight)

**Trained to detect:**
- ✅ Eco-positive: `public_transport`, `bicycle`, `electric_scooter`, `tree`, `cloth_bag`, `recycle_bin`, `waste_segregation`, `solar_panel_clean`, `wind_turbine`, `biogas_ready`, `garden_tools`
- ❌ Eco-negative: `plastic_waste`, `solar_panel_dusty`, `smoking`, `water_bottle`

**Scoring:**
- Each detected object contributes to eco score based on weight
- Eco-positive objects: +0.6 to +1.0
- Eco-negative objects: -0.2 to -0.7

### 2. CLIP Image-Text Alignment (30% weight)

**Eco Keywords:**
`sustainability`, `renewable energy`, `solar power`, `wind energy`, `recycling`, `eco-friendly`, `green`, `environment`, `nature`, `conservation`, etc.

**Scoring:**
- Calculates similarity between image and eco keywords
- Average of top 5 keyword matches

### 3. EfficientNet Classification (20% weight)

**Function:**
- Lightweight image classification
- Maps ImageNet classes to eco-friendliness
- Nature/outdoor/green classes score higher

### 4. Text Analysis (10% weight)

**Function:**
- Keyword matching in post text
- Eco-related terms boost score

## Eco Scoring Logic

### Final Score Calculation

```python
final_score = (
    yolo_score * 0.4 +      # Object detection (most important)
    clip_score * 0.3 +      # Image-text alignment
    efficientnet_score * 0.2 +  # Classification
    text_score * 0.1        # Text keywords
)
```

### Verdict Threshold

- **Score > 0.8** → `is_eco = True` ✅
- **Score ≤ 0.8** → `is_eco = False` ❌

### Example Scores

| Content | YOLOv8 | CLIP | EfficientNet | Text | **Final** | Verdict |
|---------|--------|------|--------------|------|-----------|---------|
| Solar panels + "renewable energy" | 0.95 | 0.88 | 0.75 | 0.90 | **0.87** | ✅ Eco |
| Bicycle in park + "cycling to work" | 0.90 | 0.82 | 0.70 | 0.85 | **0.83** | ✅ Eco |
| Plastic waste | 0.30 | 0.45 | 0.40 | 0.20 | **0.35** | ❌ Not Eco |
| Generic photo | 0.50 | 0.55 | 0.60 | 0.40 | **0.53** | ❌ Not Eco |

## Setup Instructions

### 1. Place Your Trained YOLOv8 Model

```bash
# Copy your trained model to:
backend/ml/models/yolov8_eco.pt
```

Your model should be trained to detect the eco-related classes listed above.

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- PyTorch + torchvision
- Ultralytics (YOLOv8)
- CLIP (OpenAI)
- Celery + Redis
- ML verification dependencies

### 3. Configure Environment

Add to your `.env` file:

```env
# IPFS
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080

# Redis (for Celery)
REDIS_URL=redis://127.0.0.1:6379/0

# Verifier Private Key (for signing verdicts)
# Generate new key or use existing:
VERIFIER_PRIVATE_KEY=0x1234567890abcdef...

# Optional: AWS KMS for production
# AWS_KMS_KEY_ID=your-kms-key-id
```

### 4. Generate Verifier Key (First Time)

```bash
python -c "from eth_account import Account; acc = Account.create(); print(f'Private Key: {acc.key.hex()}'); print(f'Address: {acc.address}')"
```

Save the private key to `.env` as `VERIFIER_PRIVATE_KEY`.

**Important:** This address becomes your **verifier identity**. Anyone can verify that verdicts come from this address.

### 5. Start Services

#### Option A: Development (Local)

```bash
# Terminal 1: Start backend API
make dev

# Terminal 2: Start Celery worker
celery -A backend.ml.worker worker --loglevel=info

# Terminal 3: Ensure Redis is running
redis-server
```

#### Option B: Production (Docker)

```bash
cd infrastructure
docker-compose -f docker-compose.ml.yml up -d
```

This starts:
- Backend API (port 8000)
- ML API (port 8001)
- Celery worker (background)
- IPFS node (ports 5001, 8080)
- Redis (port 6379)

## API Usage

### 1. Submit Content for Verification

```bash
POST /api/verify/verify
Content-Type: application/json

{
  "ipfs_cid": "QmYourImageCID...",
  "text_content": "Check out my new solar panels!",
  "post_id": "post_123",
  "author_wallet": "0x123...",
  "async_mode": true
}
```

**Response:**
```json
{
  "status": "queued",
  "task_id": "celery-task-uuid-123"
}
```

### 2. Check Verification Status

```bash
GET /api/verify/status/{task_id}
```

**Response (in progress):**
```json
{
  "task_id": "celery-task-uuid-123",
  "state": "PROCESSING",
  "ready": false,
  "status": "Running ML inference..."
}
```

**Response (completed):**
```json
{
  "task_id": "celery-task-uuid-123",
  "state": "SUCCESS",
  "ready": true,
  "successful": true,
  "result": {
    "status": "success",
    "verdict": {
      "is_eco": true,
      "confidence": 0.87,
      "breakdown": {
        "yolo_score": 0.92,
        "clip_score": 0.85,
        "efficientnet_score": 0.78,
        "text_score": 0.90
      },
      "detected_objects": ["solar_panel_clean", "tree"],
      "reasoning": "Eco-friendly content detected (confidence: 87.0%). Detected eco-positive objects: solar_panel_clean, tree."
    },
    "signed_verdict_cid": "QmSignedVerdictCID...",
    "signature": "0xabc123...",
    "verifier_address": "0x456..."
  }
}
```

### 3. Retrieve Signed Verdict from IPFS

```bash
GET /api/verify/verdict/{signed_verdict_cid}
```

**Response:**
```json
{
  "signed_verdict": {
    "verdict": {...},
    "nonce": "abc123...",
    "timestamp": "2026-01-09T12:00:00",
    "payload_hash": "sha256hash...",
    "signature": "0xabc123...",
    "verifier_address": "0x456...",
    "version": "1.0"
  },
  "signature_valid": true,
  "ipfs_cid": "QmSignedVerdictCID..."
}
```

### 4. Verify Signature Manually

```bash
POST /api/verify/verify-signature
Content-Type: application/json

{
  "verdict": {...},
  "signature": "0xabc123...",
  "verifier_address": "0x456...",
  ...
}
```

## Integration with Post Creation

### Frontend Flow

```javascript
// 1. Upload image to IPFS
const imageCID = await uploadToIPFS(imageFile);

// 2. Create post with content
const postData = {
  content: "My new solar panels!",
  image_cid: imageCID,
  author: wallet.address
};

// 3. Trigger verification
const verifyResponse = await fetch('/api/verify/verify', {
  method: 'POST',
  body: JSON.stringify({
    ipfs_cid: imageCID,
    text_content: postData.content,
    author_wallet: wallet.address
  })
});

const { task_id } = await verifyResponse.json();

// 4. Poll for result
const checkStatus = async () => {
  const status = await fetch(`/api/verify/status/${task_id}`);
  const data = await status.json();
  
  if (data.ready && data.successful) {
    // Verification complete!
    const { verdict, signed_verdict_cid } = data.result;
    
    // 5. Store post with verification metadata
    postData.verified = verdict.is_eco;
    postData.eco_score = verdict.confidence;
    postData.signed_verdict_cid = signed_verdict_cid;
    
    // Save to OrbitDB
    await orbitdb.posts.add(postData);
  } else {
    // Still processing, check again in 2 seconds
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```

## Decentralized Verification

### Anyone Can Verify!

1. **Fetch signed verdict from IPFS:**
```bash
ipfs cat QmSignedVerdictCID...
```

2. **Verify signature:**
```javascript
import { verifyMessage } from 'ethers';

const isValid = verifyMessage(
  verdict.payload_hash,
  verdict.signature
) === verdict.verifier_address;
```

3. **Check verifier reputation:**
- Is this a trusted verifier address?
- Check history of verdicts from this verifier
- Community can vote on verifier trustworthiness

### Verifier Transparency

- All verdicts are public on IPFS
- Signatures prevent tampering
- Nonce + timestamp prevent replay attacks
- Community can audit verifier accuracy

## Production Deployment

### AWS KMS Integration (Recommended)

For production, use AWS KMS to secure the verifier private key:

1. Create KMS key in AWS
2. Install boto3: `pip install boto3`
3. Configure:
```env
AWS_KMS_KEY_ID=your-kms-key-id
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

4. Signer will automatically use KMS

### Scaling

**Horizontal Scaling:**
```bash
# Add more Celery workers
docker-compose -f docker-compose.ml.yml up -d --scale ml-worker=5
```

**GPU Acceleration:**
- Docker compose already configured for NVIDIA GPU
- Will automatically use CUDA if available
- 10-50x faster inference

### Monitoring

**Health Check:**
```bash
GET /api/verify/health
```

**Celery Worker Status:**
```bash
celery -A backend.ml.worker inspect active
```

## Model Updates

### Replacing YOLOv8 Model

```bash
# 1. Train new model
# 2. Copy to models directory
cp path/to/new_model.pt backend/ml/models/yolov8_eco.pt

# 3. Restart services
docker-compose -f docker-compose.ml.yml restart ml-api ml-worker
```

### Updating Eco Keywords (CLIP)

Edit [backend/ml/eco_scorer.py](backend/ml/eco_scorer.py):

```python
ECO_KEYWORDS = [
    'sustainability',
    'renewable energy',
    # Add your keywords here...
]
```

### Adjusting Score Weights

Edit [backend/ml/eco_scorer.py](backend/ml/eco_scorer.py):

```python
weights = {
    'yolo': 0.4,       # Adjust these weights
    'clip': 0.3,
    'efficientnet': 0.2,
    'text': 0.1
}
```

## Testing

### Unit Tests

```bash
pytest backend/ml/tests/
```

### Manual Testing

```bash
# Test verification endpoint
curl -X POST http://localhost:8000/api/verify/verify \
  -H "Content-Type: application/json" \
  -d '{
    "ipfs_cid": "QmTest...",
    "text_content": "solar panels",
    "async_mode": false
  }'
```

## Security Considerations

1. **Private Key Security**
   - Use AWS KMS in production
   - Never commit private key to git
   - Rotate keys periodically

2. **Signature Verification**
   - Always verify signatures before trusting verdicts
   - Check nonce to prevent replays
   - Validate timestamp freshness

3. **Model Security**
   - Keep trained models secure
   - Version control model updates
   - Monitor for adversarial attacks

## Troubleshooting

### Models Not Loading

```bash
# Check model file exists
ls -lh backend/ml/models/yolov8_eco.pt

# Check PyTorch installation
python -c "import torch; print(torch.__version__)"
```

### Celery Worker Not Processing

```bash
# Check Redis connection
redis-cli ping

# Check Celery can connect
celery -A backend.ml.worker inspect ping
```

### IPFS Connection Errors

```bash
# Check IPFS daemon
ipfs id

# Test IPFS API
curl http://localhost:5001/api/v0/version
```

## Future Enhancements

- [ ] Multi-language support for text analysis
- [ ] Video verification (eco-friendly activities)
- [ ] Community voting on verifier accuracy
- [ ] Federated learning for model improvements
- [ ] Carbon footprint calculation for posts
- [ ] Integration with green blockchain networks

## License

Same as main project.

---

**Built with ❤️ for a sustainable, decentralized future 🌍**
