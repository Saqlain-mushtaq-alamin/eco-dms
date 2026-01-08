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
)


@celery_app.task(name='verify_eco_content', bind=True)
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
        
        # Get IPFS gateway URL
        ipfs_gateway = os.getenv('IPFS_GATEWAY_URL', 'http://localhost:8080')
        
        # Perform verification
        self.update_state(
            state='PROCESSING',
            meta={'status': 'Running ML inference...'}
        )
        
        # Run async verification (need to handle in sync context)
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        verdict = loop.run_until_complete(
            verifier.verify_from_ipfs(ipfs_cid, ipfs_gateway, text_content)
        )
        
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
        
        signed_cid = _store_verdict_on_ipfs(signed_verdict)
        
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
        # Log error and return failure
        error_result = {
            'status': 'error',
            'error': str(e),
            'ipfs_cid': ipfs_cid,
            'post_id': post_id,
        }
        
        # Still update state
        self.update_state(
            state='FAILURE',
            meta=error_result
        )
        
        return error_result


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


@celery_app.task(name='get_verification_status')
def get_verification_status(task_id: str) -> Dict:
    """
    Get the status of a verification task.
    
    Args:
        task_id: Celery task ID
    
    Returns:
        Task status and result (if completed)
    """
    task = celery_app.AsyncResult(task_id)
    
    response = {
        'task_id': task_id,
        'state': task.state,
        'ready': task.ready(),
        'successful': task.successful() if task.ready() else None,
    }
    
    if task.ready():
        if task.successful():
            response['result'] = task.result
        else:
            response['error'] = str(task.info)
    elif task.state == 'PROCESSING':
        response['status'] = task.info.get('status', 'Processing...')
    
    return response


# For running worker: celery -A backend.ml.worker worker --loglevel=info
