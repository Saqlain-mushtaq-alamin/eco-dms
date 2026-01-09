# ML Verifier Setup Guide

## Overview
The ML Verifier uses multiple AI models to verify if social media posts are eco-friendly:
- **YOLOv8s**: Object detection for eco-related items
- **CLIP**: Image-text semantic alignment
- **EfficientNet**: General image classification

The system is **fully decentralized** - verification happens off-chain via background workers.

## Architecture

```
User Post → IPFS → Celery Queue → ML Worker → Verdict → IPFS
                                      ↓
                              Cryptographic Signing
```

## Prerequisites

1. **Python 3.10+** with pip
2. **Redis** server (for Celery task queue)
3. **IPFS node** (for storing images and verdicts)
4. **GPU** (optional but recommended for faster inference)

## Installation

### 1. Install ML Dependencies

```bash
cd backend
pip install -r ml/requirements-ml.txt
```

### 2. Install Redis

**Windows:**
```powershell
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

**Linux/macOS:**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

### 3. Setup YOLOv8 Model

Place your trained YOLOv8 model at:
```
backend/ml/models/yolov8_eco.pt
```

The model should be trained to detect these classes:
- public_transport
- bicycle
- electric_scooter
- tree
- cloth_bag
- recycle_bin
- waste_segregation
- plastic_waste
- biogas_ready
- solar_panel_clean
- solar_panel_dusty
- wind_turbine
- water_bottle
- garden_tools
- human
- smoking

### 4. Environment Variables

Create or update `.env` file:

```env
# IPFS Gateway
IPFS_GATEWAY_URL=http://localhost:8080

# Redis (Celery)
REDIS_URL=redis://127.0.0.1:6379/0

# Verifier Private Key (auto-generated if not set)
VERIFIER_PRIVATE_KEY=0x...

# Optional: AWS KMS for production
# AWS_KMS_KEY_ID=arn:aws:kms:...

# Optional: Verdict storage
VERDICT_STORAGE_DIR=./ml_verdicts
```

## Running the Services

### 1. Start Redis

```bash
# Windows
redis-server

# Linux/macOS
redis-server
```

### 2. Start Celery Worker

```bash
cd backend
celery -A ml.worker worker --loglevel=info
```

For Windows, you may need:
```bash
celery -A ml.worker worker --pool=solo --loglevel=info
```

### 3. Start Backend API

```bash
cd backend
python -m app.main
```

## How It Works

### 1. Post Creation Flow

```
1. User uploads image → IPFS
2. User creates post with image CID
3. Backend triggers verification task (async)
4. Celery worker processes image through ML models
5. Worker creates signed verdict → IPFS
6. Verdict CID stored in local mapping
7. Frontend displays verification badge
```

### 2. ML Verification Process

```python
# For each image:
1. YOLOv8 detects eco-related objects
   → Score based on detected objects (40% weight)

2. CLIP analyzes image-text alignment
   → Score based on eco keyword similarity (30% weight)

3. EfficientNet classifies image
   → Score based on nature/eco classes (20% weight)

4. Text analysis
   → Score based on eco keywords in post (10% weight)

5. Combined score > 0.8 → ECO ✓
   Combined score ≤ 0.8 → Not Eco ✗
```

### 3. Decentralization Features

- **No central database**: All data in IPFS
- **Optional verification**: Posts don't require ML verification
- **Cryptographic proof**: Verdicts are signed and verifiable
- **Censorship resistant**: Verdicts stored on IPFS
- **Auditable**: Anyone can verify signatures

## Testing

### Manual Test
```bash
# Test ML inference directly
cd backend
python -c "
from ml.inference import get_verifier
import asyncio

async def test():
    verifier = get_verifier()
    # Test with an image CID
    result = await verifier.verify_from_ipfs(
        'QmYourImageCID',
        'http://localhost:8080'
    )
    print(result)

asyncio.run(test())
"
```

### API Test
```bash
curl -X POST http://localhost:8000/api/verify/verify \
  -H "Content-Type: application/json" \
  -d '{
    "ipfs_cid": "QmYourImageCID",
    "text_content": "Riding my bicycle to reduce carbon emissions!",
    "async_mode": false
  }'
```

## Monitoring

### Check Celery Worker Status
```bash
celery -A ml.worker inspect active
celery -A ml.worker inspect stats
```

### Check Redis Queue
```bash
redis-cli
> LLEN celery
> KEYS *
```

### View Verdicts
```bash
cat backend/ml_verdicts/verdicts.json
```

## Production Deployment

### 1. Use AWS KMS for Key Management

```python
# Update signer.py to use KMS
signer = VerdictSigner(use_kms=True)
```

### 2. Scale Celery Workers

```bash
# Run multiple workers
celery -A ml.worker worker --concurrency=4 --loglevel=info
```

### 3. Use Production Redis

```env
REDIS_URL=redis://your-redis-cluster:6379/0
```

### 4. GPU Acceleration

The models will automatically use CUDA if available:
```python
device = 'cuda' if torch.cuda.is_available() else 'cpu'
```

## Troubleshooting

### Models Not Loading
- Verify `yolov8_eco.pt` exists in `backend/ml/models/`
- Check Python path and imports
- Verify torch/torchvision versions

### Celery Tasks Not Running
- Ensure Redis is running
- Check Celery worker logs
- Verify task names match

### Low Confidence Scores
- Check YOLOv8 model training quality
- Adjust weights in `EcoScorer`
- Lower threshold from 0.8 if needed

### Frontend Not Showing Badges
- Verify verdicts are being stored in `ml_verdicts/verdicts.json`
- Check that `get_verdict_for_post()` is working
- Ensure post CIDs match between creation and lookup

## Advanced Configuration

### Custom Scoring Weights

Edit `backend/ml/eco_scorer.py`:
```python
weights = {
    'yolo': 0.5,        # Increase YOLO importance
    'clip': 0.2,
    'efficientnet': 0.2,
    'text': 0.1
}
```

### Custom Eco Threshold

```python
# In EcoScorer.__init__
self.eco_threshold = 0.7  # Lower = more posts marked as eco
```

## Support

For issues or questions:
1. Check logs: Celery worker, Redis, backend API
2. Verify environment variables
3. Test models individually
4. Check IPFS connectivity
