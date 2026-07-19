"""
Celery Worker for Eco Verification
Processes verification jobs asynchronously using Redis queue
"""
import os
import json
import httpx
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, List
from dotenv import load_dotenv
from celery import Celery
from backend.app.services.redis_service import redis_service

# Load backend/.env using an absolute path so this works regardless of the
# process working directory (e.g. when Celery is launched from the repo root).
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

from .inference import get_verifier
from .signer import VerdictSigner
from .fraud.pipeline import fraud_pipeline

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
    beat_schedule={
        'watchdog-stale-verifications-every-10m': {
            'task': 'watchdog_stale_verifications',
            'schedule': 600.0,
        },
        'claim-engagement-bonuses-every-30m': {
            'task': 'claim_engagement_bonuses',
            'schedule': 1800.0,
        },
    },
)


class NonRetryableVerificationError(RuntimeError):
    """Permanent verification failure that should not be retried."""


class RetryableVerificationError(RuntimeError):
    """Transient verification failure that can be retried."""


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def _status_key(post_cid: str) -> str:
    return f"verification_status:{post_cid}"


def _verdict_key(post_cid: str) -> str:
    return f"verdict:{post_cid}"


def _normalize_ipfs_cid(value: Optional[str]) -> str:
    """Normalize possible IPFS URL/path forms to a raw CID."""
    if not value:
        return ""
    cid = str(value).strip()
    if cid.startswith("ipfs://"):
        cid = cid[len("ipfs://"):]
    cid = cid.replace("/ipfs/", "")
    cid = cid.replace("ipfs/", "")
    cid = cid.strip("/")
    return cid


def _read_status(post_cid: str) -> Dict:
    raw = redis_service.get_json(_status_key(post_cid))
    return raw if isinstance(raw, dict) else {}


def _write_status(post_cid: str, updates: Dict) -> None:
    current = _read_status(post_cid)
    current.update(updates)
    current["updated_at"] = _utc_now_iso()
    redis_service.set_json(_status_key(post_cid), current)


def set_verification_status(
    post_cid: str,
    status: str,
    task_id: Optional[str] = None,
    attempts: Optional[int] = None,
    last_error: Optional[str] = None,
    queued_at: Optional[str] = None,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None,
    ipfs_cids: Optional[List[str]] = None,
    text_content: Optional[str] = None,
    author_wallet: Optional[str] = None,
) -> None:
    updates: Dict = {"status": status}
    if task_id is not None:
        updates["task_id"] = task_id
    if attempts is not None:
        updates["attempts"] = attempts
    if last_error is not None:
        updates["last_error"] = last_error
    if queued_at is not None:
        updates["queued_at"] = queued_at
    if started_at is not None:
        updates["started_at"] = started_at
    if completed_at is not None:
        updates["completed_at"] = completed_at
    if ipfs_cids is not None:
        updates["ipfs_cids"] = ipfs_cids
    if text_content is not None:
        updates["text_content"] = text_content
    if author_wallet is not None:
        updates["author_wallet"] = author_wallet.lower()
    _write_status(post_cid, updates)


@celery_app.task(
    name='verify_eco_content',
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError),
    retry_backoff=True,
    retry_jitter=True,
)
def verify_eco_content(
    self,
    ipfs_cid: Optional[str] = None,
    ipfs_cids: Optional[List[str]] = None,
    text_content: Optional[str] = None,
    post_id: Optional[str] = None,
    author_wallet: Optional[str] = None
) -> Dict:
    """
    Celery task: Verify eco-friendliness of IPFS content.
    
    Args:
        ipfs_cid: IPFS CID of one image to verify (legacy)
        ipfs_cids: List of IPFS CIDs for multi-image post verification
        text_content: Optional post text content
        post_id: Optional post identifier
        author_wallet: Optional author wallet address
    
    Returns:
        Dict with verification result and signed verdict
    """
    try:
        media_cids = [_normalize_ipfs_cid(cid) for cid in (ipfs_cids or []) if cid]
        media_cids = [cid for cid in media_cids if cid]
        if not media_cids and ipfs_cid:
            normalized = _normalize_ipfs_cid(ipfs_cid)
            if normalized:
                media_cids = [normalized]
        if not media_cids:
            raise NonRetryableVerificationError("Either ipfs_cid or ipfs_cids must be provided")

        post_cid = post_id or media_cids[0]
        current_attempt = int(self.request.retries or 0) + 1
        set_verification_status(
            post_cid=post_cid,
            status='processing',
            task_id=self.request.id,
            attempts=current_attempt,
            started_at=_utc_now_iso(),
            ipfs_cids=media_cids,
            text_content=text_content,
            author_wallet=author_wallet,
        )

        # Update task state
        self.update_state(
            state='PROCESSING',
            meta={'status': 'Fetching content from IPFS...'}
        )
        
        # Get verifier instance
        verifier = get_verifier()

        # Get IPFS gateway URLs - try multiple gateways
        primary_gateway = os.getenv('IPFS_GATEWAY_URL', 'http://localhost:8080')
        fallback_gateways = [
            "https://ipfs.nftstorage.link",
            "https://ipfs.io",
            "https://dweb.link",
        ]

        # ── Fraud Detection (before ML inference) ───────────────
        self.update_state(state='PROCESSING', meta={'status': 'Running fraud checks...'})
        try:
            # Fetch primary image bytes for fraud checks
            _fraud_image_bytes = None
            with __import__('httpx').Client(timeout=10) as _hc:
                for _gw in [primary_gateway] + fallback_gateways:
                    try:
                        _r = _hc.get(f"{_gw}/ipfs/{media_cids[0]}")
                        if _r.status_code == 200:
                            _fraud_image_bytes = _r.content
                            break
                    except Exception:
                        pass

            fraud_result = fraud_pipeline.run(
                image_bytes=_fraud_image_bytes,
                post_cid=post_cid,
                wallet=author_wallet or "",
                text_content=text_content,
            )

            if fraud_result.block:
                set_verification_status(
                    post_cid=post_cid, status='failed',
                    task_id=self.request.id,
                    attempts=current_attempt,
                    completed_at=_utc_now_iso(),
                    last_error=f"FRAUD_BLOCKED: {fraud_result.summary}",
                )
                return {
                    'status': 'fraud_blocked',
                    'fraud_score': fraud_result.fraud_score,
                    'reasons': fraud_result.reasons,
                    'post_id': post_id,
                    'author_wallet': author_wallet,
                }
        except Exception as _fe:
            print(f"[worker] Fraud check error (non-fatal): {_fe}")
            fraud_result = None

        # Perform ML inference
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
            for gateway_base in gateways_to_try:
                
                try:
                    if len(media_cids) == 1:
                        verdict = loop.run_until_complete(
                            verifier.verify_from_ipfs(media_cids[0], gateway_base, text_content)
                        )
                    else:
                        verdict = loop.run_until_complete(
                            verifier.verify_images_from_ipfs(media_cids, gateway_base, text_content)
                        )
                    # Success! Break out of loop
                    break
                except httpx.HTTPStatusError as e:
                    last_error = f"Gateway {gateway_base}: {e.response.status_code}"
                    continue  # Try next gateway
                except (httpx.ConnectError, httpx.TimeoutException) as e:
                    last_error = f"Gateway {gateway_base}: {type(e).__name__}"
                    continue  # Try next gateway
                except RuntimeError as e:
                    # Verifier failures caused by gateway/cid fetch issues are retryable.
                    last_error = f"Gateway {gateway_base}: {e}"
                    continue  # Try next gateway
            
            if verdict is None:
                # All gateways failed
                raise RetryableVerificationError(
                    f"Failed to fetch content from IPFS after trying {len(gateways_to_try)} gateways. Last error: {last_error}"
                )
        finally:
            loop.close()
        
        # Add metadata
        verdict_with_metadata = {
            **verdict,
            'ipfs_cid': media_cids[0],
            'ipfs_cids': media_cids,
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
            media_cids,
            signed_cid,
            verdict,
            post_id,
            signed_verdict=signed_verdict,
            task_id=self.request.id,
            attempts=current_attempt,
        )

        set_verification_status(
            post_cid=post_cid,
            status='completed',
            task_id=self.request.id,
            attempts=current_attempt,
            completed_at=_utc_now_iso(),
            last_error="",
        )

        # Auto-open community voting window now that ML has finished.
        _open_voting_window_for_post(
            post_cid=post_id or media_cids[0],
            confidence=verdict.get('confidence', 0),
            poster_wallet=author_wallet,
        )

        # ── On-chain reward via DynamicVerification ───────────────
        # Only trigger if the verdict is eco-positive AND we have a wallet.
        # Non-fatal: if on-chain call fails, the off-chain record is still good.
        chain_tx_hash = None
        is_eco = verdict.get('is_eco', verdict.get('eco', False))
        if is_eco and author_wallet and signed_verdict.get('chain_verdict') and signed_verdict.get('signature'):
            try:
                chain_tx_hash = _submit_dynamic_verification(
                    chain_verdict=signed_verdict['chain_verdict'],
                    signature=signed_verdict['signature'],
                )
                print(f"[worker] DynamicVerification.verifyAndReward tx: {chain_tx_hash}")
            except Exception as _ce:
                print(f"[worker] On-chain reward failed (non-fatal): {_ce}")

        # Return result
        result = {
            'status': 'success',
            'ipfs_cid': media_cids[0],
            'ipfs_cids': media_cids,
            'post_id': post_id,
            'author_wallet': author_wallet,
            'confidence': verdict.get('confidence', 0.0),
            'eco': is_eco,
            'verdict': verdict,
            'signed_verdict_cid': signed_cid,
            'signature': signed_verdict['signature'],
            'verifier_address': signed_verdict['verifier_address'],
            'chain_tx_hash': chain_tx_hash,
        }

        return result

    except NonRetryableVerificationError as e:
        post_cid = post_id or ipfs_cid or ((ipfs_cids or [None])[0])
        if post_cid:
            set_verification_status(
                post_cid=post_cid,
                status='failed',
                task_id=self.request.id,
                attempts=int(self.request.retries or 0) + 1,
                last_error=str(e),
            )
        raise
    except (RetryableVerificationError, httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
        post_cid = post_id or ipfs_cid or ((ipfs_cids or [None])[0])
        current_attempt = int(self.request.retries or 0) + 1
        if post_cid:
            if self.request.retries < self.max_retries:
                set_verification_status(
                    post_cid=post_cid,
                    status='retrying',
                    task_id=self.request.id,
                    attempts=current_attempt,
                    last_error=str(e),
                )
            else:
                set_verification_status(
                    post_cid=post_cid,
                    status='failed',
                    task_id=self.request.id,
                    attempts=current_attempt,
                    last_error=f"Maximum retries exceeded: {e}",
                )

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        raise
    except Exception as e:
        post_cid = post_id or ipfs_cid or ((ipfs_cids or [None])[0])
        if post_cid:
            set_verification_status(
                post_cid=post_cid,
                status='failed',
                task_id=self.request.id,
                attempts=int(self.request.retries or 0) + 1,
                last_error=f"{type(e).__name__}: {e}",
            )
        raise


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
    media_cids: List[str],
    verdict_cid: Optional[str], 
    verdict: Dict,
    post_id: Optional[str] = None,
    signed_verdict: Optional[Dict] = None,
    task_id: Optional[str] = None,
    attempts: Optional[int] = None,
) -> None:
    """
    Store mapping of media/post CID to verdict CID in a JSON file.
    This is a simple local storage for demo - in production, use Redis/DB.
    
    Args:
        media_cids: Media/image IPFS CIDs
        verdict_cid: Signed verdict IPFS CID (None if IPFS storage failed)
        verdict: Verification result
        post_id: Optional post CID (if provided, verdict will be indexed by both)
    """
    # Prepare verdict data
    verdict_data = {
        'verdict_cid': verdict_cid,
        'eco': verdict.get('is_eco', verdict.get('eco', False)),  # Support both formats
        'confidence': verdict.get('confidence', 0.0),
        'media_cids': media_cids,
        'total_images': verdict.get('total_images', len(media_cids)),
        'analyzed_images': verdict.get('analyzed_images', len(media_cids)),
        'failed_images': verdict.get('failed_images', []),
        'per_image_results': verdict.get('per_image_results', []),
        'verified_at': datetime.utcnow().isoformat(),
        'status': 'completed',
        'task_id': task_id,
        'attempts': attempts,
        'last_error': '',
        'queued_at': _read_status(post_id or media_cids[0]).get('queued_at'),
        'started_at': _read_status(post_id or media_cids[0]).get('started_at'),
        'completed_at': _utc_now_iso(),
    }

    if signed_verdict:
        verdict_data['signature'] = signed_verdict.get('signature')
        verdict_data['verifier_address'] = signed_verdict.get('verifier_address')
        verdict_data['chain_verdict'] = signed_verdict.get('chain_verdict')
        verdict_data['eip712_domain'] = signed_verdict.get('eip712_domain')
        verdict_data['eip712_types'] = signed_verdict.get('eip712_types')
    
    target_ids = list(dict.fromkeys(media_cids + ([post_id] if post_id else [])))
    payload = json.dumps(verdict_data)
    for target_id in target_ids:
        try:
            redis_service.client.hset(_verdict_key(target_id), mapping={"payload": payload})
        except Exception as e:
            print(f"⚠️ Failed to persist verdict in Redis for {target_id}: {e}")



def _submit_dynamic_verification(chain_verdict: Dict, signature: str) -> Optional[str]:
    """
    Submit a signed eco verdict to DynamicVerification.verifyAndReward() on-chain.

    Args:
        chain_verdict: EIP-712 Verdict struct dict from VerdictSigner
        signature: Hex signature string (0x-prefixed or not)

    Returns:
        Transaction hash hex string, or None on failure
    """
    from web3 import Web3

    rpc_url = (
        os.getenv('RPC_URL')
        or os.getenv('HARDHAT_RPC_URL')
        or 'http://127.0.0.1:8545'
    )
    contract_addr = (
        os.getenv('DYNAMIC_VERIFICATION_ADDRESS')
        or os.getenv('VITE_DYNAMIC_VERIFICATION_ADDRESS')
    )
    private_key = (
        os.getenv('VERIFIER_PRIVATE_KEY')
        or os.getenv('HARDHAT_DEPLOYER_PRIVATE_KEY')
    )

    if not contract_addr or not private_key:
        raise RuntimeError(
            "DYNAMIC_VERIFICATION_ADDRESS and VERIFIER_PRIVATE_KEY must be set to submit on-chain"
        )

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise RuntimeError(f"RPC not reachable at {rpc_url}")

    abi = [{
        "inputs": [
            {"name": "postCid",    "type": "string"},
            {"name": "isEco",      "type": "bool"},
            {"name": "confidence", "type": "uint256"},
            {"name": "timestamp",  "type": "uint256"},
            {"name": "nonce",      "type": "uint256"},
            {"name": "wallet",     "type": "address"},
            {"name": "signature",  "type": "bytes"},
        ],
        "name": "verifyAndReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }]

    account = w3.eth.account.from_key(private_key)
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_addr),
        abi=abi,
    )
    sig_bytes = bytes.fromhex(signature.lstrip('0x'))
    tx = contract.functions.verifyAndReward(
        chain_verdict['postCid'],
        chain_verdict['isEco'],
        chain_verdict['confidence'],
        chain_verdict['timestamp'],
        chain_verdict['nonce'],
        Web3.to_checksum_address(chain_verdict['wallet']),
        sig_bytes,
    ).build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 250_000,
        'gasPrice': w3.eth.gas_price,
    })
    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    if receipt.status != 1:
        raise RuntimeError(f"verifyAndReward reverted (tx={tx_hash.hex()})")
    return tx_hash.hex()


def _open_voting_window_for_post(
    post_cid: str,
    confidence: float,
    poster_wallet: Optional[str],
) -> None:
    """
    Open a community voting window for a post after ML verification completes.
    Called from inside the Celery task — imports are deferred to avoid circular deps.
    """
    if not poster_wallet:
        print(f"[voting] Skipping window open for {post_cid} — no poster_wallet")
        return

    try:
        from backend.app.services.voting_service import voting_service

        # Normalise confidence to 0-1 range (ML returns 0-100 sometimes)
        conf = confidence / 100.0 if confidence > 1.0 else float(confidence)

        if voting_service.get_status(post_cid):
            print(f"[voting] Window already open for {post_cid}, skipping")
            return

        voting_service.open_window(
            post_cid=post_cid,
            ml_confidence=conf,
            poster_wallet=poster_wallet,
        )
        print(f"[voting] Opened window for {post_cid} (confidence={conf:.2f})")
    except Exception as e:
        # Non-fatal — verdict is already stored, just log the failure
        print(f"[voting] Failed to open window for {post_cid}: {e}")


def get_verdict_for_post(post_cid: str) -> Optional[Dict]:
    """
    Get verdict for a post CID.
    
    Args:
        post_cid: Post IPFS CID
    
    Returns:
        Verdict data if available
    """
    # Redis-first lookup (authoritative).
    try:
        raw = redis_service.client.hget(_verdict_key(post_cid), "payload")
        if raw:
            return json.loads(raw)
    except Exception:
        pass

    # Backward compatibility fallback: local JSON mapping.
    base_dir = Path(__file__).parent.parent
    storage_dir = Path(os.getenv('VERDICT_STORAGE_DIR', str(base_dir / 'ml_verdicts')))
    mapping_file = storage_dir / 'verdicts.json'
    if mapping_file.exists():
        try:
            with open(mapping_file, 'r', encoding='utf-8') as f:
                mappings = json.load(f)
            return mappings.get(post_cid)
        except Exception:
            return None
    return None


@celery_app.task(name='watchdog_stale_verifications')
def watchdog_stale_verifications() -> Dict:
    """Requeue stale queued/processing verification tasks and finalize exhausted retries."""
    scanned = 0
    requeued = 0
    failed = 0
    now = datetime.utcnow()

    try:
        keys = redis_service.client.keys("verification_status:*") or []
    except Exception as e:
        return {"scanned": 0, "requeued": 0, "failed": 0, "error": str(e)}

    for key in keys:
        scanned += 1
        try:
            key_str = key.decode('utf-8') if isinstance(key, (bytes, bytearray)) else str(key)
            raw = redis_service.get_json(key_str)
            if not isinstance(raw, dict):
                continue

            status = str(raw.get("status", "")).lower()
            attempts = int(raw.get("attempts", 1) or 1)
            post_cid = key_str.split("verification_status:", 1)[-1]

            def _parse_iso(value: Optional[str]) -> Optional[datetime]:
                if not value or not isinstance(value, str):
                    return None
                try:
                    return datetime.fromisoformat(value.replace("Z", ""))
                except Exception:
                    return None

            queued_at = _parse_iso(raw.get("queued_at"))
            updated_at = _parse_iso(raw.get("updated_at"))

            should_requeue = False
            if status == "queued" and queued_at and (now - queued_at).total_seconds() > 15 * 60:
                should_requeue = True
            elif status == "processing" and updated_at and (now - updated_at).total_seconds() > 10 * 60:
                should_requeue = True
            elif status == "failed" and attempts < 4 and updated_at and (now - updated_at).total_seconds() > 10 * 60:
                # Auto-reverify failed posts without requiring manual action.
                should_requeue = True

            if status == "retrying" and attempts >= 4:
                set_verification_status(
                    post_cid=post_cid,
                    status="failed",
                    attempts=attempts,
                    last_error="Maximum retries exceeded",
                )
                failed += 1
                continue

            if status == "failed" and attempts >= 4:
                # Terminal failed state after automatic re-verification attempts are exhausted.
                continue

            if not should_requeue:
                continue

            ipfs_cids = raw.get("ipfs_cids") or []
            text_content = raw.get("text_content")
            author_wallet = raw.get("author_wallet")
            if not ipfs_cids:
                set_verification_status(
                    post_cid=post_cid,
                    status="failed",
                    attempts=attempts,
                    last_error="Watchdog cannot requeue: missing ipfs_cids",
                )
                failed += 1
                continue

            task = celery_app.send_task(
                'verify_eco_content',
                kwargs={
                    'ipfs_cid': ipfs_cids[0],
                    'ipfs_cids': ipfs_cids,
                    'text_content': text_content,
                    'post_id': post_cid,
                    'author_wallet': author_wallet,
                }
            )

            set_verification_status(
                post_cid=post_cid,
                status="queued" if status == "queued" else "retrying",
                task_id=task.id,
                attempts=attempts + 1,
                queued_at=_utc_now_iso(),
                last_error=raw.get("last_error", "") or "",
                ipfs_cids=ipfs_cids,
                text_content=text_content,
                author_wallet=author_wallet,
            )
            requeued += 1
        except Exception:
            traceback.print_exc()
            continue

    return {
        "scanned": scanned,
        "requeued": requeued,
        "failed": failed,
    }


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
# For beat:           celery -A backend.ml.worker beat  --loglevel=info


@celery_app.task(name='claim_engagement_bonuses')
def claim_engagement_bonuses() -> dict:
    """
    Periodic task: claim engagement bonuses for all verified posts
    whose 24h engagement window has closed.
    Runs every 30 minutes via Celery beat.
    """
    try:
        from backend.app.services.bonus_claimer import run_bonus_claimer
        result = run_bonus_claimer()
        print(f"[bonus_claimer] {result}")
        return result
    except Exception as e:
        print(f"[bonus_claimer] Failed: {e}")
        return {"error": str(e)}
