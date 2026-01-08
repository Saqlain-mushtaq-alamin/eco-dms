# Quick Start Guide - ML Eco Verifier

## 🚀 Fast Setup (5 minutes)

### Prerequisites
- Python 3.11+
- IPFS daemon running
- Redis server running
- Your trained YOLOv8 model

### Step 1: Place Your Model

```bash
# Copy your trained YOLOv8 model
cp path/to/your/yolov8_eco.pt backend/ml/models/yolov8_eco.pt
```

Your model should be trained to detect these classes:
- Eco-positive: `public_transport`, `bicycle`, `electric_scooter`, `tree`, `cloth_bag`, `recycle_bin`, `waste_segregation`, `biogas_ready`, `solar_panel_clean`, `wind_turbine`, `garden_tools`
- Eco-negative: `plastic_waste`, `solar_panel_dusty`, `smoking`, `water_bottle`

### Step 2: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs all ML dependencies including:
- PyTorch + CUDA (if GPU available)
- YOLOv8 (ultralytics)
- CLIP
- Celery + Redis

### Step 3: Generate Verifier Key

```bash
python -c "from eth_account import Account; acc = Account.create(); print(f'\nAdd to .env:\nVERIFIER_PRIVATE_KEY={acc.key.hex()}\n\nVerifier Address: {acc.address}\n')"
```

Copy the private key to your `.env` file.

### Step 4: Configure Environment

Add to `backend/.env`:

```env
# IPFS
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080

# Redis
REDIS_URL=redis://127.0.0.1:6379/0

# Verifier (use key from Step 3)
VERIFIER_PRIVATE_KEY=0x...your_key_here...
```

### Step 5: Start Services

```bash
# Terminal 1: Start backend
cd backend
make dev
# Or: uvicorn app.main:app --reload

# Terminal 2: Start Celery worker
celery -A backend.ml.worker worker --loglevel=info

# Terminal 3: Ensure Redis is running
redis-server

# Terminal 4: Ensure IPFS is running
ipfs daemon
```

### Step 6: Test Verification

```bash
# Check health
curl http://localhost:8000/api/verify/health

# Submit test verification (replace with your IPFS CID)
curl -X POST http://localhost:8000/api/verify/verify \
  -H "Content-Type: application/json" \
  -d '{
    "ipfs_cid": "QmYourImageCID",
    "text_content": "My solar panels!",
    "async_mode": true
  }'

# Response:
# {"status":"queued","task_id":"abc-123-xyz"}

# Check status
curl http://localhost:8000/api/verify/status/abc-123-xyz
```

## 🐳 Docker Quick Start (Even Faster!)

```bash
# 1. Place your model
cp your_model.pt backend/ml/models/yolov8_eco.pt

# 2. Create .env with verifier key
echo "VERIFIER_PRIVATE_KEY=0x..." > backend/.env

# 3. Start everything
cd infrastructure
docker-compose -f docker-compose.ml.yml up -d

# 4. Check logs
docker-compose -f docker-compose.ml.yml logs -f ml-worker

# 5. Test
curl http://localhost:8000/api/verify/health
```

## 📊 Understanding Results

### Example Verification Result

```json
{
  "is_eco": true,
  "confidence": 0.87,
  "breakdown": {
    "yolo_score": 0.92,      // YOLOv8 detected eco objects
    "clip_score": 0.85,      // Image matches eco keywords
    "efficientnet_score": 0.78,  // Classified as eco-friendly
    "text_score": 0.90       // Text contains eco keywords
  },
  "detected_objects": ["solar_panel_clean", "tree"],
  "reasoning": "Eco-friendly content detected (confidence: 87.0%). Detected eco-positive objects: solar_panel_clean, tree."
}
```

### Score Interpretation

| Confidence | Verdict | Meaning |
|-----------|---------|---------|
| 0.81-1.00 | ✅ ECO | Strongly eco-friendly |
| 0.60-0.80 | ❌ Not Eco | Eco-related but below threshold |
| 0.40-0.59 | ❌ Not Eco | Neutral/unclear |
| 0.00-0.39 | ❌ Not Eco | Not eco-friendly |

## 🔐 Signature Verification

Every verdict is cryptographically signed and stored on IPFS.

### Verify a Verdict

```javascript
// Frontend verification
const response = await fetch(`/api/verify/verdict/${signedVerdictCID}`);
const { signed_verdict, signature_valid } = await response.json();

if (signature_valid) {
  console.log("✅ Verdict is authentic!");
  console.log("Verified by:", signed_verdict.verifier_address);
} else {
  console.log("❌ Verdict signature invalid!");
}
```

### Manual Verification (Anyone Can Do This!)

```python
from eth_account import Account
from eth_account.messages import encode_defunct

# Fetch signed verdict from IPFS
signed_verdict = fetch_from_ipfs(cid)

# Verify signature
message = encode_defunct(hexstr=signed_verdict['payload_hash'])
recovered_address = Account.recover_message(
    message, 
    signature=signed_verdict['signature']
)

assert recovered_address == signed_verdict['verifier_address']
print("✅ Signature verified!")
```

## 🎯 Integration with Posts

### Backend Integration

```python
# In your post creation endpoint
from ml.worker import verify_eco_content

@router.post("/api/posts")
async def create_post(post_data: PostCreate):
    # 1. Upload image to IPFS
    image_cid = await upload_to_ipfs(post_data.image)
    
    # 2. Trigger verification
    task = verify_eco_content.delay(
        ipfs_cid=image_cid,
        text_content=post_data.content,
        author_wallet=post_data.author
    )
    
    # 3. Save post with verification task ID
    post = {
        "content": post_data.content,
        "image_cid": image_cid,
        "verification_task_id": task.id,
        "verified": False  # Will update when verification completes
    }
    
    return {"post_id": "123", "verification_task_id": task.id}
```

### Frontend Integration

```javascript
// 1. Create post
const createResponse = await createPost({
  content: "My solar panels!",
  image: imageFile
});

const { post_id, verification_task_id } = createResponse;

// 2. Poll for verification result
const pollVerification = async () => {
  const status = await fetch(`/api/verify/status/${verification_task_id}`);
  const data = await status.json();
  
  if (data.ready && data.successful) {
    // Verification complete!
    const { verdict, signed_verdict_cid } = data.result;
    
    // Update post with verification
    await updatePost(post_id, {
      verified: verdict.is_eco,
      eco_score: verdict.confidence,
      signed_verdict_cid: signed_verdict_cid
    });
    
    // Show badge to user
    if (verdict.is_eco) {
      showEcoBadge(verdict.confidence);
    }
  } else if (!data.ready) {
    // Still processing
    setTimeout(pollVerification, 2000);
  }
};

pollVerification();
```

## 🔧 Troubleshooting

### Models Not Loading

**Error:** `FileNotFoundError: yolov8_eco.pt not found`

**Solution:**
```bash
# Check model exists
ls -lh backend/ml/models/yolov8_eco.pt

# Copy your model
cp your_model.pt backend/ml/models/yolov8_eco.pt
```

### CUDA Out of Memory

**Error:** `RuntimeError: CUDA out of memory`

**Solution:**
```python
# Use CPU instead
# In .env:
ML_DEVICE=cpu

# Or reduce batch size in inference.py
```

### Celery Worker Not Starting

**Error:** `Cannot connect to Redis`

**Solution:**
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG

# If not, start Redis
redis-server
```

### IPFS Connection Failed

**Error:** `ConnectionError: Cannot connect to IPFS`

**Solution:**
```bash
# Check IPFS daemon
ipfs id

# If not running, start it
ipfs daemon
```

## 📈 Performance

### Inference Speed

| Hardware | YOLOv8 | CLIP | EfficientNet | Total |
|----------|--------|------|--------------|-------|
| CPU (i7) | ~2s | ~1s | ~0.5s | ~3.5s |
| GPU (RTX 3060) | ~0.2s | ~0.1s | ~0.05s | ~0.35s |

### Throughput

- **Single Worker:** ~10-30 verifications/minute (CPU) or ~100-200/minute (GPU)
- **5 Workers:** ~50-150/minute (CPU) or ~500-1000/minute (GPU)

### Optimization Tips

1. **Use GPU:** 10-50x faster
2. **Batch Processing:** Process multiple images together
3. **Model Quantization:** Reduce model size for faster loading
4. **Caching:** Cache results for duplicate images

## 🎓 Next Steps

1. **Train Your Model:** Fine-tune YOLOv8 on your eco dataset
2. **Customize Scoring:** Adjust weights in `eco_scorer.py`
3. **Add More Models:** Integrate additional ML models
4. **Deploy to Production:** Use Docker + AWS KMS
5. **Monitor Performance:** Add metrics and logging

## 📚 Resources

- [YOLOv8 Documentation](https://docs.ultralytics.com/)
- [CLIP Paper](https://arxiv.org/abs/2103.00020)
- [Celery Documentation](https://docs.celeryproject.org/)
- [IPFS Documentation](https://docs.ipfs.io/)

## 🆘 Support

Having issues? Check:
1. [Full README](README.md) for detailed docs
2. [Examples](examples.py) for code samples
3. GitHub Issues for common problems

---

**Happy Eco Verifying! 🌍✅**
