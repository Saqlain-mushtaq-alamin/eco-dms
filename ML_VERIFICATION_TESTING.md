# ML Verification Integration - Testing Guide

## What Was Fixed

### Backend Issues Fixed:
1. ✅ **Post creation now triggers ML verification** - When a post with images is created, it automatically queues verification
2. ✅ **Verification verdicts are stored** - Uses local JSON storage (`ml_verdicts/verdicts.json`) for post CID → verdict mapping
3. ✅ **Posts API includes verification data** - All post fetching endpoints now include `verified`, `eco_score`, and `signed_verdict_cid` fields
4. ✅ **Non-blocking verification** - Verification runs asynchronously via Celery, doesn't block post creation

### Frontend (Already Working):
✅ Green checkmark icon for eco posts
✅ Gray X icon for non-eco posts  
✅ Confidence percentage display
✅ Hover effects and interactions
✅ Progress bars in modal
✅ Color coding (green/gray)
✅ Responsive design
✅ Detailed verification modal

## Why It Wasn't Working Before

1. **Backend wasn't triggering verification**: Post creation endpoint didn't call the ML worker
2. **No verdict storage**: Verdicts weren't being saved in a way posts could retrieve them
3. **Posts didn't include verification fields**: API responses missing `verified`, `eco_score`, `signed_verdict_cid`

## How to Test (Without ML Models)

### Option 1: Create Test Verdicts for Existing Posts

1. **Get your post CIDs** from the frontend (check network tab or console)

2. **Edit the test script**:
```bash
cd backend
notepad create_test_verdicts.py
```

3. **Add your post CIDs**:
```python
test_verdicts = {
    "bafybeiYOUR_ACTUAL_POST_CID_HERE": {
        "verdict_cid": "bafybei_mock_verdict_cid",
        "eco": True,
        "confidence": 0.85,
        "verified_at": datetime.utcnow().isoformat(),
    },
    "bafybeiANOTHER_POST_CID": {
        "verdict_cid": "bafybei_mock_verdict_cid_2",
        "eco": False,
        "confidence": 0.35,
        "verified_at": datetime.utcnow().isoformat(),
    },
}
```

4. **Run the script**:
```bash
python create_test_verdicts.py
```

5. **Refresh your frontend** - You should now see eco badges!

### Option 2: Full Integration with ML Models

1. **Install ML dependencies**:
```bash
pip install -r requirements.txt
```

2. **Place your trained model**:
```bash
# Copy your YOLOv8 model to:
backend/ml/models/yolov8_eco.pt
```

3. **Set environment variables**:
```bash
# Create backend/.env
VERIFIER_PRIVATE_KEY=0x1234...  # Your private key
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080
REDIS_URL=redis://localhost:6379/0
```

4. **Start Redis**:
```bash
docker run -d -p 6379:6379 redis:alpine
```

5. **Start Celery worker**:
```bash
cd backend
celery -A backend.ml.worker worker --loglevel=info
```

6. **Create a post with an eco image** - Verification will happen automatically!

## How the Flow Works Now

```
User creates post with image
         ↓
Backend saves to IPFS
         ↓
Backend triggers verify_eco_content.delay(cid) ← Celery async task
         ↓
Post created response returned immediately (non-blocking)
         ↓
[Background] Celery worker processes verification
         ↓
[Background] ML models analyze image
         ↓
[Background] Verdict stored in ml_verdicts/verdicts.json
         ↓
Frontend fetches posts
         ↓
Backend reads verdict from storage
         ↓
Frontend displays eco badge ✅/❌
```

## Verification Data Structure

### Stored in `ml_verdicts/verdicts.json`:
```json
{
  "bafybeiXXX": {
    "verdict_cid": "bafybeiYYY",
    "eco": true,
    "confidence": 0.85,
    "verified_at": "2026-01-09T12:34:56.789Z"
  }
}
```

### Returned in Post API:
```json
{
  "cid": "bafybeiXXX",
  "content": "My eco post!",
  "verified": true,
  "eco_score": 0.85,
  "signed_verdict_cid": "bafybeiYYY",
  ...
}
```

## Quick Test Checklist

- [ ] Backend server is running
- [ ] Frontend is running
- [ ] Created test verdicts with script OR started Celery worker
- [ ] Refreshed frontend page
- [ ] Can see eco badges (green ✓ or gray ✗)
- [ ] Badges show confidence percentage
- [ ] Clicking badge opens modal
- [ ] Modal shows detailed verification data

## Troubleshooting

### "No badges showing"
1. Check browser console for errors
2. Check Network tab - are posts including `verified` and `eco_score` fields?
3. Verify `ml_verdicts/verdicts.json` has entries for your post CIDs
4. Make sure backend restarted after code changes

### "Verdicts not being created automatically"
1. Check Redis is running: `redis-cli ping` should return `PONG`
2. Check Celery worker is running and connected to Redis
3. Check backend logs for errors when creating posts
4. Verify post has images (`media_cids` not empty)

### "Modal not opening"
1. Check browser console for errors
2. Verify `signed_verdict_cid` field exists in post data
3. Check IPFS gateway is accessible

## Next Steps

1. **Test with mock data** (Option 1 above) - Fastest way to see it working
2. **Deploy full ML pipeline** (Option 2 above) - For real verification
3. **Customize styling** - Adjust badge colors, modal design, etc.
4. **Scale Celery** - Add more workers for throughput
5. **Production deployment** - Use Redis cluster, AWS KMS for signing

## Files Changed

### Backend:
- `backend/app/posts_manage/post_routes.py` - Triggers verification, includes verdict in responses
- `backend/ml/worker.py` - Stores verdicts, provides lookup function
- `backend/create_test_verdicts.py` - NEW - Helper script for testing

### Frontend:
- `apps/web/src/pages/Feed.tsx` - Already has badges and modal (was working!)

## Support

If badges still don't show after following this guide:
1. Share post API response (check Network tab in browser)
2. Share `ml_verdicts/verdicts.json` content
3. Share browser console errors
4. Share backend logs
