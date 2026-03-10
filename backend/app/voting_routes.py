"""Community Voting API Routes"""

import logging
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional

from .auth_routes import get_current_user
from .services.voting_service import VoteChoice, voting_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/votes", tags=["voting"])


# ── Request / Response schemas ────────────────────────────────────────────────

class CastVoteRequest(BaseModel):
    choice: VoteChoice = Field(..., description="'eco' or 'not_eco'")
    signature: str = Field(
        ...,
        description="EIP-712 signed vote message from the user's wallet",
    )
    eco_token_balance: float = Field(
        0.0,
        ge=0,
        description="Caller's current ECO token balance (read from chain by frontend)",
    )


class OpenWindowRequest(BaseModel):
    """Called internally by /api/posts route after ML finishes."""
    poster_wallet: str
    ml_confidence: float = Field(..., ge=0.0, le=1.0)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/{post_cid}/open-window", status_code=201)
async def open_voting_window(
    post_cid: str,
    body: OpenWindowRequest,
    authorization: Optional[str] = Header(default=None),
):
    """
    Open a voting window for a post.
    Called by the backend after ML analysis completes.
    Idempotent — if the window already exists it returns the existing status.
    """
    existing = voting_service.get_status(post_cid)
    if existing and existing.get("window_open"):
        return {"status": "already_open", "window": existing}

    window = voting_service.open_window(
        post_cid=post_cid,
        ml_confidence=body.ml_confidence,
        poster_wallet=body.poster_wallet,
    )
    return {"status": "opened", "window": window}


@router.post("/{post_cid}")
async def cast_vote(
    post_cid: str,
    body: CastVoteRequest,
    authorization: Optional[str] = Header(default=None),
):
    """
    Cast a community vote on a post.

    Rules enforced:
    • Must hold ≥ 10 ECO tokens
    • One vote per wallet per post
    • Cannot vote on own post
    • Max 50 votes per day
    • Window must still be open
    • Signature stored for on-chain audit trail
    """
    wallet: str = await get_current_user(authorization)

    ok, message = voting_service.cast_vote(
        post_cid=post_cid,
        wallet=wallet,
        choice=body.choice,
        signature=body.signature,
        eco_token_balance=body.eco_token_balance,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=message)

    return {"success": True, "message": message}


@router.get("/{post_cid}/status")
async def get_vote_status(
    post_cid: str,
    authorization: Optional[str] = Header(default=None),
):
    """
    Get public voting status for a post.

    While the window is open:
    • Only shows total vote count, time remaining, and whether the viewer voted.
    • Individual votes and breakdown are hidden.

    After the window closes:
    • Eco / Not-Eco counts revealed.
    • Final verdict shown.
    """
    viewer_wallet: Optional[str] = None
    try:
        viewer_wallet = await get_current_user(authorization)
    except Exception:
        pass

    status = voting_service.get_public_status(post_cid, viewer_wallet)
    if not status:
        # No voting window exists yet for this post — return gracefully instead of 404
        return {
            "window_open": False,
            "exists": False,
            "post_cid": post_cid,
        }
    return status


@router.get("/{post_cid}/my-vote")
async def get_my_vote(
    post_cid: str,
    authorization: Optional[str] = Header(default=None),
):
    """
    Returns whether the authenticated user has voted on this post.
    Does NOT reveal their choice.
    """
    wallet: str = await get_current_user(authorization)
    has_voted = voting_service.has_voted(post_cid, wallet)
    return {"has_voted": has_voted, "post_cid": post_cid}


@router.post("/{post_cid}/settle")
async def settle_post(
    post_cid: str,
    authorization: Optional[str] = Header(default=None),
):
    """
    Compute the final settlement data for a post.

    Called by:
    • A cron job after the deadline passes
    • Admin/owner manually

    Returns the data needed to call CommunityVoting.settlePost() on-chain.
    The actual on-chain call happens from a separate signing script.
    """
    settlement = voting_service.compute_settlement(post_cid)
    if not settlement:
        raise HTTPException(status_code=404, detail="No voting data for this post")

    return {
        "status": "computed",
        "settlement": settlement,
        "note": "Submit this to CommunityVoting.settlePost() on-chain",
    }
