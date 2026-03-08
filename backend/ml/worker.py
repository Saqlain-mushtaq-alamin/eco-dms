"""
Celery Worker for Eco Verification
Processes verification jobs asynchronously using Redis queue
"""
import os
import json
import httpx
from datetime import datetime
from celery import Celery
from typing import Dict, Optional

from .inference import get_verifier
from .signer import VerdictSigner

# Initialize Celery
redis_url = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
celery_app = Celery(
    'eco_verifier',
    broker=redis_url,
    backend=redis_url
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    result_expires=86400,  # Results expire after 24 hours
    task_acks_late=True,  # Acknowledge task after completion
    worker_prefetch_multiplier=1,  # Fetch one task at a time
    result_backend_transport_options={
        'retry_policy': {
            'timeout': 5.0
        }
    },
)


@celery_app.task(name='verify_eco_content', bind=True, throws=(Exception,))
def verify_eco_content(
    self,
    ipfs_cid: str,
    text_content: Optional[str] = None,
    post_id: Optional[str] = None,
    author_wallet: Optional[str] = None
) -> Dict:
    """
    Celery task: Verify eco-friendliness of IPFS content.
    
    Args:
        ipfs_cid: IPFS CID of the image to verify
        text_content: Optional post text content
        post_id: Optional post identifier
        author_wallet: Optional author wallet address
    
    Returns:
        Dict with verification result and signed verdict
    """
    try:
        # Update task state
        self.update_state(
            state='PROCESSING',
            meta={'status': 'Fetching content from IPFS...'}
        )
        
        # Get verifier instance
        verifier = get_verifier()
        
        # Get IPFS gateway URLs - try multiple gateways
        primary_gateway = os.getenv('IPFS_GATEWAY_URL', 'http://localhost:8080')
        # Fallback to public gateways if local fails
        fallback_gateways = [
            f"https://{ipfs_cid}.ipfs.nftstorage.link",
            f"https://ipfs.io/ipfs/{ipfs_cid}",
            f"https://dweb.link/ipfs/{ipfs_cid}",
        ]
        
        # Perform verification
        self.update_state(
            state='PROCESSING',
            meta={'status': 'Running ML inference...'}
        )
        
        # Run async verification (need to handle in sync context)
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        verdict = None
        last_error = None
        
        # Try primary gateway first
        gateways_to_try = [primary_gateway] + fallback_gateways
        
        try:
            for gateway_url in gateways_to_try:
                # Extract base URL if CID is already in the URL
                if ipfs_cid in gateway_url:
                    # Already a full URL, use directly
                    gateway_base = gateway_url.rsplit('/ipfs/', 1)[0]
                else:
                    gateway_base = gateway_url
                
                try:
                    verdict = loop.run_until_complete(
                        verifier.verify_from_ipfs(ipfs_cid, gateway_base, text_content)
                    )
                    # Success! Break out of loop
                    break
                except httpx.HTTPStatusError as e:
                    last_error = f"Gateway {gateway_base}: {e.response.status_code}"
                    continue  # Try next gateway
                except (httpx.ConnectError, httpx.TimeoutException) as e:
                    last_error = f"Gateway {gateway_base}: {type(e).__name__}"
                    continue  # Try next gateway
            
            if verdict is None:
                # All gateways failed
                raise Exception(f"Failed to fetch content from IPFS after trying {len(gateways_to_try)} gateways. Last error: {last_error}")
        finally:
            loop.close()
        
        # Add metadata
        verdict_with_metadata = {
            **verdict,
            'ipfs_cid': ipfs_cid,
            'post_id': post_id,
            'author_wallet': author_wallet,
            'verified_at': datetime.utcnow().isoformat(),
            'verifier_version': '1.0.0',
        }
        
        # Sign the verdict
        self.update_state(
            state='PROCESSING',
            meta={'status': 'Signing verdict...'}
        )
        
        signer = VerdictSigner()
        signed_verdict = signer.sign_verdict(verdict_with_metadata)
        
        # Store signed verdict on IPFS
        self.update_state(
            state='PROCESSING',
            meta={'status': 'Storing signed verdict on IPFS...'}
        )
        
        try:
            signed_cid = _store_verdict_on_ipfs(signed_verdict)
        except Exception as e:
            # If storing on IPFS fails, log but continue (store locally only)
            print(f"Warning: Failed to store verdict on IPFS: {e}")
            signed_cid = None
        
        # Store mapping of post CID to verdict CID
        self.update_state(
            state='PROCESSING',
            meta={'status': 'Storing verdict mapping...'}
        )
        
        # Store verdict indexed by both media CID and post ID
        _store_verdict_mapping(
            ipfs_cid,
            signed_cid,
            verdict,
            post_id,
            signed_verdict=signed_verdict,
        )
        
        # Return result
        result = {
            'status': 'success',
            'verdict': verdict,
            'signed_verdict_cid': signed_cid,
            'signature': signed_verdict['signature'],
            'verifier_address': signed_verdict['verifier_address'],
        }
        
        return result
    
    except Exception as e:
        # Create JSON-serializable error response
        error_msg = str(e)
        error_type = type(e).__name__
        
        error_result = {
            'status': 'error',
            'error': error_msg,
            'error_type': error_type,
            'ipfs_cid': ipfs_cid,
            'post_id': post_id,
        }
        
        # Don't call update_state in exception handler - just raise
        # Celery will handle state update automatically
        raise Exception(f"{error_type}: {error_msg}")


def _store_verdict_on_ipfs(signed_verdict: Dict) -> str:
    """
    Store signed verdict on IPFS.
    
    Args:
        signed_verdict: The signed verification result
    
    Returns:
        IPFS CID of the stored verdict
    """
    ipfs_api = os.getenv('IPFS_API_URL', 'http://localhost:5001')
    
    # Convert to JSON bytes
    verdict_json = json.dumps(signed_verdict, indent=2).encode('utf-8')
    
    # Upload to IPFS
    import requests
    response = requests.post(
        f"{ipfs_api}/api/v0/add",
        files={'file': verdict_json},
        timeout=30
    )
    
    response.raise_for_status()
    result = response.json()
    
    cid = result['Hash']
    
    # Pin the verdict
    requests.post(
        f"{ipfs_api}/api/v0/pin/add?arg={cid}",
        timeout=10
    )
    
    return cid


def _store_verdict_mapping(
    media_cid: str, 
    verdict_cid: Optional[str], 
    verdict: Dict,
    post_id: Optional[str] = None,
    signed_verdict: Optional[Dict] = None,
) -> None:
    """
    Store mapping of media/post CID to verdict CID in a JSON file.
    This is a simple local storage for demo - in production, use Redis/DB.
    
    Args:
        media_cid: Media/image IPFS CID
        verdict_cid: Signed verdict IPFS CID (None if IPFS storage failed)
        verdict: Verification result
        post_id: Optional post CID (if provided, verdict will be indexed by both)
    """
    import os
    import json
    from pathlib import Path
    
    # Use absolute path based on this file's location
    base_dir = Path(__file__).parent.parent  # backend directory
    storage_dir = Path(os.getenv('VERDICT_STORAGE_DIR', str(base_dir / 'ml_verdicts')))
    storage_dir.mkdir(exist_ok=True)
    
    # Store mapping
    mapping_file = storage_dir / 'verdicts.json'
    
    # Load existing mappings
    mappings = {}
    if mapping_file.exists():
        try:
            with open(mapping_file, 'r') as f:
                mappings = json.load(f)
        except Exception:
            pass
    
    # Prepare verdict data
    verdict_data = {
        'verdict_cid': verdict_cid,
        'eco': verdict.get('is_eco', verdict.get('eco', False)),  # Support both formats
        'confidence': verdict.get('confidence', 0.0),
        'verified_at': datetime.utcnow().isoformat(),
    }

    if signed_verdict:
        verdict_data['signature'] = signed_verdict.get('signature')
        verdict_data['verifier_address'] = signed_verdict.get('verifier_address')
        verdict_data['chain_verdict'] = signed_verdict.get('chain_verdict')
        verdict_data['eip712_domain'] = signed_verdict.get('eip712_domain')
        verdict_data['eip712_types'] = signed_verdict.get('eip712_types')
    
    # Store by media CID (always)
    mappings[media_cid] = verdict_data
    
    # Also store by post ID if provided (allows lookup by post CID)
    if post_id:
        mappings[post_id] = verdict_data
    
    # Save updated mappings
    with open(mapping_file, 'w') as f:
        json.dump(mappings, f, indent=2)


def get_verdict_for_post(post_cid: str) -> Optional[Dict]:
    """
    Get verdict for a post CID.
    
    Args:
        post_cid: Post IPFS CID
    
    Returns:
        Verdict data if available
    """
    import os
    import json
    from pathlib import Path
    
    # Use absolute path based on this file's location
    base_dir = Path(__file__).parent.parent  # backend directory
    storage_dir = Path(os.getenv('VERDICT_STORAGE_DIR', str(base_dir / 'ml_verdicts')))
    mapping_file = storage_dir / 'verdicts.json'
    
    if not mapping_file.exists():
        return None
    
    try:
        with open(mapping_file, 'r') as f:
            mappings = json.load(f)
        return mappings.get(post_cid)
    except Exception:
        return None


@celery_app.task(name='get_verification_status')
def get_verification_status(task_id: str) -> Dict:
    """
    Get the status of a verification task.
    
    Args:
        task_id: Celery task ID
    
    Returns:
        Task status and result (if completed)
    """
    try:
        task = celery_app.AsyncResult(task_id)
        
        # Map Celery states to user-friendly status
        state = task.state
        if state == 'SUCCESS':
            status = 'completed'
        elif state == 'FAILURE':
            status = 'failed'
        elif state == 'PENDING':
            status = 'pending'
        elif state == 'STARTED' or state == 'PROCESSING':
            status = 'processing'
        else:
            status = state.lower()
        
        response = {
            'task_id': task_id,
            'status': status,  # User-friendly status
            'state': task.state,  # Raw Celery state
            'ready': task.ready(),
            'successful': task.successful() if task.ready() else None,
        }
        
        if task.ready():
            if task.successful():
                response['result'] = task.result
                response['status'] = 'completed'
            else:
                # Handle error info safely
                error_info = task.info
                if isinstance(error_info, Exception):
                    response['error'] = str(error_info)
                elif isinstance(error_info, dict):
                    response['error'] = error_info.get('error', str(error_info))
                else:
                    response['error'] = str(error_info)
                response['status'] = 'failed'
        elif task.state == 'PROCESSING':
            if isinstance(task.info, dict):
                response['progress'] = task.info.get('status', 'Processing...')
            else:
                response['progress'] = 'Processing...'
        
        return response
    
    except Exception as e:
        # Return error if task lookup fails
        return {
            'task_id': task_id,
            'status': 'error',
            'error': f'Failed to retrieve task status: {str(e)}'
        }


# For running worker: celery -A backend.ml.worker worker --loglevel=info
