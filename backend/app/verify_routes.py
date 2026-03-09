"""
Eco Verification API Routes
Endpoints for ML-based eco verification of social media posts
"""
import logging
import time
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict
import httpx
import os
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

from ..ml.worker import get_verification_status, celery_app
from ..ml.inference import get_verifier
from ..ml.signer import VerdictSigner
from .services.orbitdb_service import orbitdb_service
from .posts_manage.ipfs_post_service import ipfs_service
from .deps import get_current_user

try:
    from backend.ml.worker import get_verdict_for_post
except ImportError:
    get_verdict_for_post = None

router = APIRouter(prefix="/api/verify", tags=["verification"])


def _upsert_verdict_mapping(post_cid: str, updates: Dict) -> None:
    """Persist additional fields for an existing verdict mapping entry."""
    base_dir = Path(__file__).resolve().parent.parent  # backend directory
    storage_dir = Path(os.getenv('VERDICT_STORAGE_DIR', str(base_dir / 'ml_verdicts')))
    mapping_file = storage_dir / 'verdicts.json'
    if not mapping_file.exists():
        return

    try:
        with open(mapping_file, 'r', encoding='utf-8') as f:
            mappings = json.load(f)
    except Exception:
        return

    current = mappings.get(post_cid)
    if not isinstance(current, dict):
        return

    current.update(updates)
    mappings[post_cid] = current
    with open(mapping_file, 'w', encoding='utf-8') as f:
        json.dump(mappings, f, indent=2)


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
                'verify_eco_content',
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


@router.get("/claim-payload/{post_cid}")
async def get_claim_payload(post_cid: str, chain_timestamp: int | None = Query(default=None)):
    """
    Get contract-ready EIP-712 claim payload for a verified post.

    Returns chain_verdict + signature + domain/types for verifyAndReward.
    """
    try:
        if not get_verdict_for_post:
            raise HTTPException(status_code=503, detail="Verdict lookup unavailable")

        verdict_data = get_verdict_for_post(post_cid)
        if not verdict_data:
            raise HTTPException(status_code=404, detail="No verdict found for post")

        chain_verdict = verdict_data.get('chain_verdict')
        signature = verdict_data.get('signature')
        verifier_address = verdict_data.get('verifier_address')
        eip712_domain = verdict_data.get('eip712_domain')
        eip712_types = verdict_data.get('eip712_types')

        # Backfill from signed verdict CID if local mapping is missing fields.
        verdict_cid = verdict_data.get('verdict_cid')
        if verdict_cid and (not chain_verdict or not signature):
            try:
                ipfs_gateway = os.getenv('IPFS_GATEWAY_URL', 'http://localhost:8080')
                async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                    response = await client.get(f"{ipfs_gateway}/ipfs/{verdict_cid}")
                    response.raise_for_status()
                    signed_verdict = response.json()

                chain_verdict = signed_verdict.get('chain_verdict')
                signature = signed_verdict.get('signature')
                verifier_address = signed_verdict.get('verifier_address')
                eip712_domain = signed_verdict.get('eip712_domain')
                eip712_types = signed_verdict.get('eip712_types')
            except Exception as exc:
                logger.warning("IPFS backfill failed for verdict %s (cid=%s): %s", post_cid, verdict_cid, exc)

        # Always generate a fresh claim signature so timestamp stays within contract expiry window.
        # This also auto-heals legacy verdict entries missing chain payload/signature.
        try:
            author_wallet = None
            if isinstance(chain_verdict, dict):
                author_wallet = chain_verdict.get('wallet')

            if not author_wallet:
                post_json = await ipfs_service.get_json(post_cid)
                if isinstance(post_json, dict):
                    author_wallet = post_json.get('author') or post_json.get('author_wallet')

            if author_wallet:
                signer = VerdictSigner()
                regenerated = signer.sign_verdict({
                    'post_id': post_cid,
                    'ipfs_cid': post_cid,
                    'author_wallet': author_wallet,
                    'is_eco': bool(verdict_data.get('eco', False)),
                    'confidence': float(verdict_data.get('confidence', 0.0)),
                    'verified_at': verdict_data.get('verified_at'),
                    # NOTE: chain_timestamp intentionally omitted.
                    # _build_chain_verdict() will call _get_reference_timestamp()
                    # to fetch the CURRENT block timestamp from the RPC so the
                    # resulting signature is always fresh and never rejected as
                    # "verdict expired" by the contract.
                })

                chain_verdict = regenerated.get('chain_verdict')
                signature = regenerated.get('signature')
                verifier_address = regenerated.get('verifier_address')
                eip712_domain = regenerated.get('eip712_domain')
                eip712_types = regenerated.get('eip712_types')

                if chain_verdict and signature:
                    _upsert_verdict_mapping(post_cid, {
                        'chain_verdict': chain_verdict,
                        'signature': signature,
                        'verifier_address': verifier_address,
                        'eip712_domain': eip712_domain,
                        'eip712_types': eip712_types,
                    })
        except Exception as exc:
            logger.warning("Fresh signature generation failed for %s: %s", post_cid, exc)
            # Fall through to the stale chain_verdict from storage; staleness is
            # checked below before returning it to the client.

        # Guard: reject any signature whose timestamp is already outside the
        # contract's 1-hour expiry window (with a 60-second safety buffer).
        # This surfaces a clear 422 instead of letting the on-chain call revert.
        if chain_verdict and signature and isinstance(chain_verdict, dict):
            verdict_ts = chain_verdict.get('timestamp')
            if verdict_ts is not None:
                age_seconds = int(time.time()) - int(verdict_ts)
                if age_seconds > 3540:  # 59 min — 1 min before the 1-hour on-chain limit
                    logger.error(
                        "Stale verdict for %s: timestamp %s is %d seconds old — "
                        "cannot produce a fresh signature (regeneration failed above). "
                        "Re-run ML verification for this post.",
                        post_cid, verdict_ts, age_seconds,
                    )
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            "Verdict signature has expired (older than 1 hour) and could not be "
                            "refreshed automatically. Please re-submit the post for ML verification."
                        ),
                    )

        if not chain_verdict or not signature:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Verdict is not claimable (missing chain payload/signature). "
                    "Re-run ML verification for this post or ensure post author metadata exists."
                ),
            )

        return {
            "post_cid": post_cid,
            "verdict_cid": verdict_cid,
            "eco": verdict_data.get('eco', False),
            "confidence": verdict_data.get('confidence', 0.0),
            "chain_verdict": chain_verdict,
            "signature": signature,
            "verifier_address": verifier_address,
            "eip712_domain": eip712_domain,
            "eip712_types": eip712_types,
        }
    except HTTPException:
        raise
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
    
    # Get explicit claim earnings from storage (or return defaults)
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

    # Fallback mode: derive earnings directly from verified eco posts.
    # This keeps dashboard rewards useful even before full on-chain claim wiring.
    derived_lifetime = 0.0
    derived_today = 0.0
    derived_total_claims = 0
    derived_last_claim_time = None

    if get_verdict_for_post:
        try:
            post_cids = await orbitdb_service.get_user_posts(wallet_address) or []
            for post_cid in post_cids:
                verdict = get_verdict_for_post(post_cid)
                if not verdict or not verdict.get("eco", False):
                    continue

                derived_total_claims += 1
                derived_lifetime += 5.0

                verified_at_raw = verdict.get("verified_at")
                if isinstance(verified_at_raw, str):
                    try:
                        verified_at = datetime.fromisoformat(verified_at_raw)
                        if verified_at > today_start:
                            derived_today += 5.0
                        if derived_last_claim_time is None or verified_at > derived_last_claim_time:
                            derived_last_claim_time = verified_at
                    except ValueError:
                        # Ignore malformed timestamps and continue with count-based totals.
                        pass
        except Exception:
            # Keep API resilient even if OrbitDB/IPFS lookups fail.
            pass

    stored_lifetime = float(wallet_earnings.get("lifetime_earned", "0") or 0)
    stored_total_claims = int(wallet_earnings.get("total_claims", 0) or 0)
    stored_last_claim_time = wallet_earnings.get("last_claim_time")

    # Use whichever source has more data so existing claim history is preserved.
    use_derived = derived_total_claims > stored_total_claims

    final_lifetime = derived_lifetime if use_derived else stored_lifetime
    final_today = derived_today if use_derived else today_earned
    final_claims = derived_total_claims if use_derived else stored_total_claims
    final_last_claim = (
        derived_last_claim_time.isoformat() if use_derived and derived_last_claim_time else stored_last_claim_time
    )
    
    return {
        "wallet_address": wallet_address,
        "lifetime_earned": str(final_lifetime),
        "today_earned": str(final_today),
        "total_claims": final_claims,
        "last_claim_time": final_last_claim,
        "source": "derived_from_verified_posts" if use_derived else "claims_storage",
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
