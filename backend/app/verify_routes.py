"""
Eco Verification API Routes
Endpoints for ML-based eco verification of social media posts
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict
import httpx
from datetime import datetime, timedelta

from ..ml.worker import get_verification_status, celery_app
from ..ml.inference import get_verifier
from ..ml.signer import VerdictSigner
from .deps import get_current_user

router = APIRouter(prefix="/api/verify", tags=["verification"])


class VerifyRequest(BaseModel):
    """Request to verify eco-friendliness of content."""
    ipfs_cid: str = Field(..., description="IPFS CID of image to verify")
    text_content: Optional[str] = Field(None, description="Optional post text content")
    post_id: Optional[str] = Field(None, description="Optional post identifier")
    author_wallet: Optional[str] = Field(None, description="Optional author wallet address")
    async_mode: bool = Field(True, description="If True, process asynchronously via Celery")


class VerifyResponse(BaseModel):
    """Response from verification request."""
    status: str
    task_id: Optional[str] = None
    verdict: Optional[Dict] = None
    signed_verdict_cid: Optional[str] = None


class SignVerdictRequest(BaseModel):
    """Request to sign a verdict."""
    verdict_data: Dict = Field(..., description="Verdict data to sign")


@router.post("/verify", response_model=VerifyResponse)
async def verify_content(request: VerifyRequest):
    """
    Verify eco-friendliness of IPFS content.
    
    - **ipfs_cid**: IPFS content identifier of the image
    - **text_content**: Optional post text for context
    - **async_mode**: If True, returns task_id for async processing (default)
    
    Returns either immediate verdict or task_id for status polling.
    """
    try:
        if request.async_mode:
            # Submit to Celery worker queue
            task = celery_app.send_task(
                'app.ml.worker.verify_eco_content',
                kwargs={
                    'ipfs_cid': request.ipfs_cid,
                    'text_content': request.text_content,
                    'post_id': request.post_id,
                    'author_wallet': request.author_wallet
                }
            )
            
            return VerifyResponse(
                status="queued",
                task_id=task.id
            )
        
        else:
            # Synchronous verification (for testing/development)
            # Call the verifier directly, not the Celery task
            verifier = get_verifier()
            import os
            from datetime import datetime
            
            ipfs_gateway = os.getenv('IPFS_GATEWAY_URL', 'http://localhost:8080')
            
            # Run verification
            import asyncio
            verdict = await verifier.verify_from_ipfs(
                request.ipfs_cid, 
                ipfs_gateway, 
                request.text_content
            )
            
            # Add metadata
            verdict_with_metadata = {
                **verdict,
                'ipfs_cid': request.ipfs_cid,
                'post_id': request.post_id,
                'author_wallet': request.author_wallet,
                'verified_at': datetime.utcnow().isoformat(),
                'verifier_version': '1.0.0',
            }
            
            # Sign the verdict
            signer = VerdictSigner()
            signed_verdict = signer.sign_verdict(verdict_with_metadata)
            
            # For sync mode, we'll skip IPFS storage and return directly
            return VerifyResponse(
                status="completed",
                verdict=verdict,
                signed_verdict_cid=None  # Not stored in sync mode
            )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """
    Get the status of a verification task.
    
    - **task_id**: Celery task ID from /verify endpoint
    
    Returns task status and result when completed.
    """
    try:
        status = get_verification_status(task_id)
        return status
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verdict/{verdict_cid}")
async def get_signed_verdict(verdict_cid: str):
    """
    Retrieve a signed verdict from IPFS.
    
    - **verdict_cid**: IPFS CID of the signed verdict
    
    Returns the full signed verdict with signature verification.
    """
    try:
        # Fetch from IPFS
        import os
        ipfs_gateway = os.getenv('IPFS_GATEWAY_URL', 'http://localhost:8080')
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{ipfs_gateway}/ipfs/{verdict_cid}")
            response.raise_for_status()
            signed_verdict = response.json()
        
        # Verify signature
        is_valid = VerdictSigner.verify_signature(signed_verdict)
        
        return {
            "signed_verdict": signed_verdict,
            "signature_valid": is_valid,
            "ipfs_cid": verdict_cid
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sign-verdict")
async def sign_verdict(request: SignVerdictRequest):
    """
    Sign a verification verdict.
    
    - **verdict_data**: The verdict data to sign
    
    Returns signed verdict with cryptographic signature.
    (Note: Typically used internally by the worker, but exposed for testing)
    """
    try:
        signer = VerdictSigner()
        signed_verdict = signer.sign_verdict(request.verdict_data)
        
        return {
            "status": "success",
            "signed_verdict": signed_verdict
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-signature")
async def verify_verdict_signature(signed_verdict: Dict):
    """
    Verify the signature of a signed verdict.
    
    - **signed_verdict**: The complete signed verdict to verify
    
    Returns whether the signature is valid.
    """
    try:
        is_valid = VerdictSigner.verify_signature(signed_verdict)
        
        return {
            "signature_valid": is_valid,
            "verifier_address": signed_verdict.get('verifier_address'),
            "timestamp": signed_verdict.get('timestamp')
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """
    Check if ML verification service is healthy.
    
    Returns status of loaded models and worker availability.
    """
    try:
        verifier = get_verifier()
        models = verifier._get_active_models()
        
        # Check Celery worker
        worker_available = False
        try:
            from backend.ml.worker import celery_app
            inspect = celery_app.control.inspect()
            stats = inspect.stats()
            worker_available = stats is not None and len(stats) > 0
        except Exception:
            pass
        
        return {
            "status": "healthy" if models else "degraded",
            "models_loaded": models,
            "yolov8_loaded": "YOLOv8" in models,
            "clip_loaded": "CLIP" in models,
            "efficientnet_loaded": "EfficientNet" in models,
            "device": verifier.device,
            "worker_available": worker_available
        }
    
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e)
        }


# In-memory storage for earnings tracking (replace with database in production)
earnings_storage = {}


@router.get("/earnings/{wallet_address}")
async def get_earnings(wallet_address: str):
    """
    Get earnings statistics for a wallet address.
    
    Returns:
    - lifetime_earned: Total ECO tokens earned (as string)
    - today_earned: ECO tokens earned in last 24 hours
    - total_claims: Number of successful claims
    - last_claim_time: ISO timestamp of last claim
    """
    # Normalize wallet address
    wallet_address = wallet_address.lower()
    
    # Get earnings from storage (or return defaults)
    wallet_earnings = earnings_storage.get(wallet_address, {
        "lifetime_earned": "0",
        "total_claims": 0,
        "claims": [],
        "last_claim_time": None
    })
    
    # Calculate today's earnings (last 24 hours)
    now = datetime.utcnow()
    today_start = now - timedelta(hours=24)
    
    today_claims = [
        claim for claim in wallet_earnings.get("claims", [])
        if datetime.fromisoformat(claim["timestamp"]) > today_start
    ]
    
    today_earned = sum(float(claim["amount"]) for claim in today_claims)
    
    return {
        "wallet_address": wallet_address,
        "lifetime_earned": wallet_earnings.get("lifetime_earned", "0"),
        "today_earned": str(today_earned),
        "total_claims": wallet_earnings.get("total_claims", 0),
        "last_claim_time": wallet_earnings.get("last_claim_time"),
    }


@router.post("/claim/record")
async def record_claim(
    wallet_address: str,
    post_cid: str,
    amount: str,
    tx_hash: str
):
    """
    Record a successful claim for earnings tracking.
    
    Called by frontend after successful blockchain transaction.
    
    Parameters:
    - wallet_address: User's wallet address
    - post_cid: IPFS CID of the verified post
    - amount: Amount of ECO tokens claimed (e.g., "5")
    - tx_hash: Blockchain transaction hash
    """
    # Normalize wallet address
    wallet_address = wallet_address.lower()
    
    # Initialize if doesn't exist
    if wallet_address not in earnings_storage:
        earnings_storage[wallet_address] = {
            "lifetime_earned": "0",
            "total_claims": 0,
            "claims": [],
            "last_claim_time": None
        }
    
    # Update earnings
    current_lifetime = float(earnings_storage[wallet_address]["lifetime_earned"])
    new_lifetime = current_lifetime + float(amount)
    
    earnings_storage[wallet_address]["lifetime_earned"] = str(new_lifetime)
    earnings_storage[wallet_address]["total_claims"] += 1
    earnings_storage[wallet_address]["last_claim_time"] = datetime.utcnow().isoformat()
    
    # Add to claims history
    earnings_storage[wallet_address]["claims"].append({
        "post_cid": post_cid,
        "amount": amount,
        "tx_hash": tx_hash,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {
        "success": True,
        "wallet_address": wallet_address,
        "lifetime_earned": str(new_lifetime),
        "total_claims": earnings_storage[wallet_address]["total_claims"],
        "tx_hash": tx_hash
    }


# Example usage in post creation flow:
"""
1. User uploads image → Gets IPFS CID
2. Backend calls POST /api/verify/verify with CID
3. Returns task_id
4. Frontend polls GET /api/verify/status/{task_id}
5. When complete, get signed_verdict_cid
6. Store signed_verdict_cid with post metadata on OrbitDB
7. Anyone can verify by fetching verdict from IPFS and checking signature

Earnings tracking flow:
1. User claims reward on blockchain
2. Transaction succeeds
3. Frontend calls POST /api/verify/claim/record with tx details
4. Backend updates earnings stats
5. Dashboard fetches GET /api/verify/earnings/{wallet}
"""
