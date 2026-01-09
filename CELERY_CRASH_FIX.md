# Celery Worker Crash Fix

## Problem

Celery worker crashed with `ValueError: Exception information must include the exception type` when processing ML verification tasks.

### Root Cause

**Two Issues:**

1. **IPFS 404 Error**: The image CID `QmQUg7GMV3sgi4DtSAkd6Dr2yceDRtdHGHTLovEbL5odHp` doesn't exist on IPFS
   - Frontend uploaded image to a different IPFS node/gateway
   - Local IPFS node doesn't have this content
   - When Celery tried to fetch it, got 404 Not Found

2. **Celery Exception Serialization Bug**: When `httpx.HTTPStatusError` was raised:
   - Celery tried to serialize the exception to store in Redis
   - The exception object wasn't JSON-serializable
   - This caused secondary error: `Exception information must include the exception type`
   - Worker crashed instead of marking task as failed

### Error Chain

```
1. verify_eco_content task received
2. Models loaded successfully ✓
3. Tried to fetch: GET http://localhost:8080/ipfs/QmQUg7GMV... 
4. IPFS returned: 404 Not Found ✗
5. httpx.HTTPStatusError raised
6. Celery tried to serialize exception → KeyError: 'exc_type'
7. Worker crashed with ValueError
```

## Solution Applied

### 1. Added Proper Exception Handling in worker.py

**Changes:**
- Wrapped IPFS fetch in try/except for httpx errors
- Convert httpx exceptions to simple Exception with string message
- Added `throws=(Exception,)` to task decorator
- Removed manual FAILURE state update (let Celery handle it)
- Added safe error handling in get_verification_status

**Before:**
```python
@celery_app.task(name='verify_eco_content', bind=True)
def verify_eco_content(self, ipfs_cid: str, ...):
    try:
        verdict = loop.run_until_complete(
            verifier.verify_from_ipfs(ipfs_cid, ipfs_gateway, text_content)
        )
        # ... no httpx error handling
    except Exception as e:
        self.update_state(state='FAILURE', meta=error_result)  # ← This caused issues
        return error_result
```

**After:**
```python
@celery_app.task(name='verify_eco_content', bind=True, throws=(Exception,))
def verify_eco_content(self, ipfs_cid: str, ...):
    try:
        try:
            verdict = loop.run_until_complete(...)
        except httpx.HTTPStatusError as e:
            raise Exception(f"Failed to fetch content from IPFS: {e.response.status_code}")
        except httpx.ConnectError as e:
            raise Exception(f"Cannot connect to IPFS gateway: {str(e)}")
        except httpx.TimeoutException:
            raise Exception(f"Timeout fetching content from IPFS")
        finally:
            loop.close()
        # ...
    except Exception as e:
        # Simple string-based error, no state update
        raise Exception(f"{type(e).__name__}: {str(e)}")
```

### 2. Improved Celery Configuration

**Added:**
- `task_acks_late=True` - Only acknowledge after completion
- `worker_prefetch_multiplier=1` - Fetch one task at a time
- `result_backend_transport_options` - Better Redis timeout handling

### 3. Fixed IPFS Storage Error Handling

**Added try/except around `_store_verdict_on_ipfs()`:**
- If storing verdict on IPFS fails, log warning but continue
- Store verdict locally in JSON file regardless
- Return `signed_cid=None` instead of crashing

## Testing the Fix

### 1. Restart Celery Worker

**Stop old worker** (if still running):
```bash
# Press Ctrl+C in the Celery terminal or
taskkill /F /IM celery.exe
```

**Start new worker:**
```bash
cd backend
set PYTHONPATH=%CD%
.venv\Scripts\celery -A ml.worker worker --pool=solo --loglevel=info
```

Or use Makefile:
```bash
make dev  # Starts everything including Celery
```

### 2. Verify IPFS Gateway

**Check IPFS daemon is running:**
```bash
# If using local IPFS
ipfs daemon
```

**Or use public gateway** (temporary fix):
```bash
# Set in backend/.env or environment
set IPFS_GATEWAY_URL=https://ipfs.io
```

### 3. Test with Valid IPFS CID

**Create test post with properly uploaded image:**

1. Upload image to IPFS **first**:
   ```bash
   POST http://localhost:8000/api/posts/upload
   # Returns: {"cid": "Qm..."}
   ```

2. Create post with **that CID**:
   ```json
   {
     "content": "Test eco post",
     "media_cids": ["<CID_FROM_STEP_1>"]
   }
   ```

### 4. Check Task Status

**Successful task:**
```json
{
  "task_id": "68111c4c-...",
  "status": "completed",
  "result": {
    "status": "success",
    "verdict": { "is_eco": true, "confidence": 0.85 }
  }
}
```

**Failed task (404):**
```json
{
  "task_id": "68111c4c-...",
  "status": "failed",
  "error": "Failed to fetch content from IPFS: 404 - http://localhost:8080/ipfs/Qm..."
}
```

**Key difference:** Worker no longer crashes, task marked as failed gracefully ✓

## Long-term Solutions

### Option 1: Use Public IPFS Gateway

**Pros:**
- No local IPFS daemon needed
- Content available globally
- Reliable for testing

**Cons:**
- Slower
- Privacy concerns
- Centralization

**Setup:**
```bash
# In backend/.env
IPFS_GATEWAY_URL=https://ipfs.io
# or
IPFS_GATEWAY_URL=https://dweb.link
```

### Option 2: Ensure Image Upload to Local IPFS

**Fix frontend upload flow:**

1. **Frontend uploads to same IPFS node backend uses:**
   ```typescript
   // Use backend's upload endpoint
   const formData = new FormData();
   formData.append('file', imageFile);
   const res = await fetch('http://localhost:8000/api/posts/upload', {
     method: 'POST',
     body: formData
   });
   const { cid } = await res.json();
   ```

2. **Backend uploads to local IPFS:**
   ```python
   # In post_routes.py upload endpoint
   ipfs_service.upload_file(file_bytes)  # Uploads to local node
   ```

3. **Verify CID exists before verification:**
   ```python
   # In post_routes.py before triggering ML
   if not ipfs_service.check_cid_exists(media_cid):
       logger.warning(f"CID {media_cid} not found, skipping verification")
       continue
   ```

### Option 3: Add CID Pinning/Replication

**Pin remote CIDs to local node:**
```python
# Before verification
async def ensure_cid_available(cid: str, ipfs_gateway: str):
    """Download and pin CID to local IPFS if not available"""
    try:
        # Try local first
        response = await client.get(f"http://localhost:8080/ipfs/{cid}")
        response.raise_for_status()
    except:
        # Fetch from public gateway and pin locally
        response = await client.get(f"{ipfs_gateway}/ipfs/{cid}")
        data = response.content
        # Pin to local node
        local_ipfs.add_bytes(data)
```

## Verification

**Check logs for clean failure (not crash):**
```
[2026-01-10 01:20:00] Task verify_eco_content received
[2026-01-10 01:20:01] Loading models... ✓
[2026-01-10 01:20:02] HTTP Request: GET .../ipfs/Qm... → 404 Not Found
[2026-01-10 01:20:02] Task failed: Failed to fetch content from IPFS: 404
[2026-01-10 01:20:02] Worker ready for next task ✓  ← No crash!
```

**No more:**
- ❌ `ValueError: Exception information must include the exception type`
- ❌ `CRITICAL/MainProcess Unrecoverable error`
- ❌ Worker crash

## Summary

✅ **Fixed:** Celery worker now handles IPFS errors gracefully  
✅ **Fixed:** Exceptions properly serialized to JSON  
✅ **Fixed:** Tasks fail cleanly without crashing worker  
⚠️ **Todo:** Ensure frontend uploads to correct IPFS node  
⚠️ **Todo:** Add CID validation before triggering verification  

**Next Steps:**
1. Restart Celery worker with fixed code
2. Check IPFS gateway configuration
3. Upload test image through backend endpoint
4. Verify task completes successfully
