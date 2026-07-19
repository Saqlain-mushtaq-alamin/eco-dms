"""
Fraud Flag API Routes
=====================
Admin-facing endpoints for the fraud review queue.

Endpoints:
  GET  /api/admin/fraud/queue          List posts flagged for review
  GET  /api/admin/fraud/queue/{cid}    Detail view of a specific flagged post
  POST /api/admin/fraud/review/{cid}   Submit human review decision
  GET  /api/admin/fraud/stats          Fraud pipeline statistics
  POST /api/admin/fraud/scan/{cid}     Force-rescan an existing post
  GET  /api/admin/fraud/blocked        List of auto-blocked posts

All endpoints require a valid admin session (verified via SIWE + admin wallet list).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from .auth_routes import require_authenticated
from .deps import get_db
from .config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/fraud", tags=["admin-fraud"])

# ─── Admin guard ──────────────────────────────────────────────────────────────
# Admin wallets are set via ADMIN_WALLETS env var (comma-separated)
def _get_admin_wallets() -> set[str]:
    raw = getattr(settings, "admin_wallets", "") or ""
    return {w.strip().lower() for w in raw.split(",") if w.strip()}


async def require_admin(current_user=Depends(require_authenticated)):
    """Dependency: user must be an admin wallet."""
    wallet = (current_user.get("wallet") or "").lower()
    admins = _get_admin_wallets()
    if admins and wallet not in admins:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ─── Redis key helpers ────────────────────────────────────────────────────────
FRAUD_FLAG_PREFIX = "fraud:flagged:"
FRAUD_BLOCK_PREFIX = "fraud:blocked:"
FRAUD_REVIEWED_PREFIX = "fraud:reviewed:"
FRAUD_STATS_KEY = "fraud:stats"


def _get_redis():
    """Lazy import to avoid circular deps."""
    from .services.redis_service import redis_service
    return redis_service.client


# ─── Pydantic models ──────────────────────────────────────────────────────────
class ReviewDecision(BaseModel):
    action: str           # "approve" | "reject" | "escalate"
    reason: Optional[str] = None
    override_impact_tier: Optional[str] = None  # override ML tier if needed


class FraudFlagEntry(BaseModel):
    post_cid: str
    wallet: str
    fraud_score: int
    reasons: list[str]
    flagged_at: float
    details: dict
    status: str           # "pending" | "approved" | "rejected" | "escalated"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[float] = None
    review_reason: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _get_flag(cid: str) -> Optional[dict]:
    r = _get_redis()
    raw = r.get(f"{FRAUD_FLAG_PREFIX}{cid}")
    if raw:
        return json.loads(raw)
    raw = r.get(f"{FRAUD_BLOCK_PREFIX}{cid}")
    if raw:
        return json.loads(raw)
    return None


def _list_keys(prefix: str, count: int = 200) -> list[str]:
    r = _get_redis()
    return [k.decode() if isinstance(k, bytes) else k
            for k in r.scan_iter(f"{prefix}*", count=count)]


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/queue")
async def get_fraud_queue(
    status: str = Query("pending", description="pending | approved | rejected | all"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    admin=Depends(require_admin),
):
    """
    List posts currently in the fraud review queue.
    Ordered by fraud score descending (highest risk first).
    """
    r = _get_redis()
    entries: list[dict] = []

    flag_keys = _list_keys(FRAUD_FLAG_PREFIX)
    for key in flag_keys:
        raw = r.get(key)
        if not raw:
            continue
        try:
            entry = json.loads(raw)
            if status == "all" or entry.get("status", "pending") == status:
                entries.append(entry)
        except Exception:
            pass

    # Sort by fraud_score descending, then flagged_at descending
    entries.sort(key=lambda e: (-e.get("fraud_score", 0), -e.get("flagged_at", 0)))
    total = len(entries)
    page = entries[offset: offset + limit]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": page,
    }


@router.get("/queue/{post_cid}")
async def get_fraud_detail(post_cid: str, admin=Depends(require_admin)):
    """Get full fraud analysis details for a specific post CID."""
    entry = _get_flag(post_cid)
    if not entry:
        raise HTTPException(status_code=404, detail=f"No fraud record for {post_cid}")
    return entry


@router.post("/review/{post_cid}")
async def submit_review(
    post_cid: str,
    decision: ReviewDecision,
    admin=Depends(require_admin),
):
    """
    Submit a human review decision for a flagged post.

    Actions:
      approve   → mark as clean, allow in feed (clears fraud flag)
      reject    → permanently block the post and warn the wallet
      escalate  → pass to senior moderator (keeps in queue with escalated status)
    """
    r = _get_redis()

    entry = _get_flag(post_cid)
    if not entry:
        raise HTTPException(status_code=404, detail=f"No fraud record for {post_cid}")

    if entry.get("status") in ("approved", "rejected"):
        raise HTTPException(
            status_code=409,
            detail=f"Post already reviewed: {entry['status']}"
        )

    if decision.action not in ("approve", "reject", "escalate"):
        raise HTTPException(status_code=400, detail="action must be approve | reject | escalate")

    reviewer_wallet = (admin.get("wallet") or "unknown").lower()
    now = time.time()

    entry.update({
        "status": decision.action + "d" if decision.action != "escalate" else "escalated",
        "reviewed_by": reviewer_wallet,
        "reviewed_at": now,
        "review_reason": decision.reason or "",
    })
    if decision.override_impact_tier:
        entry["override_impact_tier"] = decision.override_impact_tier

    # Persist updated entry
    flag_key = f"{FRAUD_FLAG_PREFIX}{post_cid}"
    r.set(flag_key, json.dumps(entry), ex=30 * 24 * 3600)  # keep 30 days

    # Also store in reviewed set for audit trail
    reviewed_key = f"{FRAUD_REVIEWED_PREFIX}{post_cid}"
    r.set(reviewed_key, json.dumps(entry), ex=90 * 24 * 3600)

    # Update aggregate stats
    _increment_stat(r, f"review_{decision.action}")

    logger.info(
        "Fraud review [%s] post=%s action=%s by=%s",
        post_cid[:12], post_cid, decision.action, reviewer_wallet[:8]
    )

    return {
        "post_cid": post_cid,
        "action": decision.action,
        "status": entry["status"],
        "reviewed_by": reviewer_wallet,
        "reviewed_at": now,
    }


@router.get("/blocked")
async def get_blocked_posts(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    admin=Depends(require_admin),
):
    """List all auto-blocked posts (fraud_score >= 60)."""
    r = _get_redis()
    entries: list[dict] = []

    block_keys = _list_keys(FRAUD_BLOCK_PREFIX)
    for key in block_keys:
        raw = r.get(key)
        if raw:
            try:
                entries.append(json.loads(raw))
            except Exception:
                pass

    entries.sort(key=lambda e: -e.get("fraud_score", 0))
    total = len(entries)
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": entries[offset: offset + limit],
    }


@router.get("/stats")
async def get_fraud_stats(admin=Depends(require_admin)):
    """
    Aggregate statistics on fraud pipeline performance.
    """
    r = _get_redis()

    # Count live queue items
    pending_keys = _list_keys(FRAUD_FLAG_PREFIX)
    pending_count = 0
    approved_count = 0
    rejected_count = 0
    escalated_count = 0

    for key in pending_keys:
        raw = r.get(key)
        if not raw:
            continue
        try:
            entry = json.loads(raw)
            status = entry.get("status", "pending")
            if status == "pending":
                pending_count += 1
            elif status == "approved":
                approved_count += 1
            elif status == "rejected":
                rejected_count += 1
            elif status == "escalated":
                escalated_count += 1
        except Exception:
            pass

    blocked_count = len(_list_keys(FRAUD_BLOCK_PREFIX))

    # Stored counters (incremented on each event)
    def _get_stat(name: str) -> int:
        v = r.hget(FRAUD_STATS_KEY, name)
        return int(v) if v else 0

    return {
        "queue": {
            "pending":   pending_count,
            "approved":  approved_count,
            "rejected":  rejected_count,
            "escalated": escalated_count,
        },
        "blocked_total": blocked_count,
        "pipeline": {
            "total_scanned":        _get_stat("scanned"),
            "duplicates_detected":  _get_stat("duplicate"),
            "ai_detected":          _get_stat("ai_generated"),
            "exif_rejected":        _get_stat("exif_reject"),
            "temporal_flagged":     _get_stat("temporal_flag"),
            "reviews_approved":     _get_stat("review_approve"),
            "reviews_rejected":     _get_stat("review_reject"),
        },
    }


@router.post("/scan/{post_cid}")
async def force_rescan(post_cid: str, admin=Depends(require_admin)):
    """
    Force-rerun the fraud pipeline on an existing post.
    Useful after updating detection thresholds.
    Triggers the Celery task for the post CID if available in Redis.
    """
    r = _get_redis()

    # Look up existing verdict
    verdict_raw = r.hget(f"verdict:{post_cid}", "payload")
    if not verdict_raw:
        raise HTTPException(
            status_code=404,
            detail=f"No verdict found for post {post_cid}. Cannot rescan."
        )

    try:
        verdict = json.loads(verdict_raw)
    except Exception:
        raise HTTPException(status_code=500, detail="Corrupt verdict data in Redis")

    # Queue the Celery rescan task
    try:
        from backend.ml.worker import process_eco_post
        task = process_eco_post.apply_async(
            kwargs={
                "ipfs_cids": verdict.get("media_cids", [post_cid]),
                "post_id": post_cid,
                "author_wallet": verdict.get("wallet"),
                "force_rescan": True,
            },
            priority=5,
        )
        return {
            "post_cid": post_cid,
            "task_id": task.id,
            "message": "Rescan task queued",
        }
    except Exception as e:
        logger.error("Rescan failed for %s: %s", post_cid, e)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Internal helper ──────────────────────────────────────────────────────────
def _increment_stat(r, name: str, amount: int = 1):
    """Increment a fraud stats counter in Redis."""
    try:
        r.hincrby(FRAUD_STATS_KEY, name, amount)
    except Exception:
        pass


def record_fraud_flag(
    post_cid: str,
    wallet: str,
    fraud_score: int,
    reasons: list[str],
    details: dict,
    blocked: bool = False,
):
    """
    Public helper called by the ML worker to persist a fraud flag into Redis.
    Imported and called from worker.py after the pipeline runs.
    """
    r = _get_redis()
    entry = {
        "post_cid": post_cid,
        "wallet": wallet,
        "fraud_score": fraud_score,
        "reasons": reasons,
        "flagged_at": time.time(),
        "details": details,
        "status": "pending",
        "blocked": blocked,
    }

    key = FRAUD_BLOCK_PREFIX if blocked else FRAUD_FLAG_PREFIX
    r.set(f"{key}{post_cid}", json.dumps(entry), ex=30 * 24 * 3600)

    _increment_stat(r, "scanned")
    if blocked:
        _increment_stat(r, "blocked")
    else:
        _increment_stat(r, "flagged")

    if details.get("duplicate", {}).get("is_duplicate"):
        _increment_stat(r, "duplicate")
    if details.get("ai_detection", {}).get("is_ai_generated"):
        _increment_stat(r, "ai_generated")
    if details.get("exif", {}).get("auto_reject"):
        _increment_stat(r, "exif_reject")
    if details.get("temporal", {}).get("burst_detected"):
        _increment_stat(r, "temporal_flag")
