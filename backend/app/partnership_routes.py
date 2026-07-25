"""
Partnership API Routes
========================
All HTTP endpoints for the Industry & Partnerships system.

  POST /api/partnerships/register              Apply for partnership
  GET  /api/partnerships/                      List all partners
  GET  /api/partnerships/{id}                  Get one partner
  POST /api/partnerships/{id}/approve          Admin: approve partner
  PATCH /api/partnerships/{id}/status          Admin: change status

  POST /api/partnerships/challenges/           Create brand challenge
  GET  /api/partnerships/challenges/           List challenges
  GET  /api/partnerships/challenges/{id}       Get challenge
  POST /api/partnerships/challenges/{id}/join  Join challenge
  POST /api/partnerships/challenges/{id}/submit  Submit a post
  GET  /api/partnerships/challenges/{id}/report  Impact report

  GET  /api/partnerships/esg/{partner_id}/dashboard   ESG stats
  POST /api/partnerships/esg/{partner_id}/report      Generate ESG report

  GET  /api/partnerships/school/{partner_id}/dashboard  School stats
  POST /api/partnerships/school/transcript              Generate eco-transcript

  GET  /api/partnerships/carbon-packages/              List packages
  POST /api/partnerships/carbon-packages/              Create package (admin)

  POST /api/partnerships/ngo/events/                   Create NGO event
  GET  /api/partnerships/ngo/events/                   List NGO events

  GET  /api/partnerships/revenue/{period}              Revenue summary (admin)
  GET  /api/partnerships/plans/esg                     ESG plan pricing
  GET  /api/partnerships/plans/school                  School plan pricing
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from .auth_routes import get_current_user, require_authenticated
from .partnership_models import (
    ChallengeCreate,
    EcoTranscriptRequest,
    ESGReportRequest,
    PartnerRegisterRequest,
    PartnerStatus,
    PartnerType,
    ESG_PLAN_PRICING,
    SCHOOL_PLAN_PRICING,
)
from .services.partnership_service import partnership_service

router = APIRouter(prefix="/api/partnerships", tags=["partnerships"])
logger = logging.getLogger(__name__)


# ─── Helper ──────────────────────────────────────────────────────────────────

def _err(status_code: int, detail: str):
    raise HTTPException(status_code=status_code, detail=detail)


# ─── Plan Pricing (public) ────────────────────────────────────────────────────

@router.get("/plans/esg", response_model=dict, summary="ESG subscription plan pricing")
async def get_esg_plans():
    """Return pricing for Tier 2 Corporate ESG plans (no auth required)."""
    return ESG_PLAN_PRICING


@router.get("/plans/school", response_model=dict, summary="School program pricing")
async def get_school_plans():
    """Return pricing for School partnership plans (no auth required)."""
    return SCHOOL_PLAN_PRICING


# ─── Partner Registration & Management ───────────────────────────────────────

@router.post("/register", response_model=dict, status_code=201, summary="Apply for partnership")
async def register_partner(
    req: PartnerRegisterRequest,
    _current_user: str = Depends(get_current_user),
):
    """
    Apply for an industry partnership.
    Status starts as **pending** — awaits DAO / admin approval.
    """
    try:
        partner = partnership_service.register_partner(req)
        return {
            "success":    True,
            "partner_id": partner.partner_id,
            "org_name":   partner.org_name,
            "status":     partner.status,
            "message":    "Application received. Pending DAO review (typically 3–5 business days).",
        }
    except Exception as e:
        logger.error("Partner registration error: %s", e, exc_info=True)
        _err(500, "Failed to register partner")


@router.get("/", response_model=list, summary="List partners")
async def list_partners(
    org_type: Optional[str] = Query(None, description="Filter by org_type"),
    status:   Optional[str] = Query(None, description="Filter by status"),
    _current_user: str = Depends(get_current_user),
):
    """List all partners, optionally filtered by type and status."""
    try:
        partners = partnership_service.list_partners(org_type=org_type, status=status)
        return [p.model_dump(mode="json") for p in partners]
    except Exception as e:
        logger.error("List partners error: %s", e, exc_info=True)
        _err(500, "Failed to list partners")


@router.get("/{partner_id}", response_model=dict, summary="Get partner")
async def get_partner(
    partner_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Get a single partner record."""
    partner = partnership_service.get_partner(partner_id)
    if not partner:
        _err(404, f"Partner {partner_id!r} not found")
    return partner.model_dump(mode="json")


@router.post("/{partner_id}/approve", response_model=dict, summary="Approve partner (admin)")
async def approve_partner(
    partner_id: str,
    current_user: dict = Depends(require_authenticated),
):
    """Admin/DAO action — approve a pending partner application."""
    approver_wallet = current_user.get("wallet", "")
    try:
        partner = partnership_service.approve_partner(partner_id, approver_wallet)
        return {
            "success":     True,
            "partner_id":  partner_id,
            "new_status":  partner.status,
            "approved_by": approver_wallet,
        }
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        logger.error("Partner approval error: %s", e, exc_info=True)
        _err(500, "Failed to approve partner")


@router.patch("/{partner_id}/status", response_model=dict, summary="Update partner status (admin)")
async def update_partner_status(
    partner_id: str,
    new_status: PartnerStatus = Body(..., embed=True),
    current_user: dict = Depends(require_authenticated),
):
    """Admin action — suspend, activate, or expire a partner."""
    try:
        partner = partnership_service.update_partner_status(partner_id, new_status)
        return {"success": True, "partner_id": partner_id, "status": partner.status}
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        _err(500, "Failed to update partner status")


# ─── Brand Challenges (Tier 1) ────────────────────────────────────────────────

@router.post("/challenges/", response_model=dict, status_code=201, summary="Create brand challenge")
async def create_challenge(
    req: ChallengeCreate,
    _current_user: str = Depends(get_current_user),
):
    """
    Create a sponsored brand challenge.
    Partner must have **approved** status.
    """
    try:
        challenge = partnership_service.create_challenge(req)
        return {
            "success":       True,
            "challenge_id":  challenge.challenge_id,
            "title":         challenge.title,
            "status":        challenge.status,
            "eco_prize_pool": challenge.eco_prize_pool,
            "burned_amount":  challenge.burned_amount,
            "platform_fee":   challenge.platform_fee,
        }
    except ValueError as e:
        _err(400, str(e))
    except Exception as e:
        logger.error("Create challenge error: %s", e, exc_info=True)
        _err(500, "Failed to create challenge")


@router.get("/challenges/", response_model=list, summary="List challenges")
async def list_challenges(
    partner_id: Optional[str] = Query(None),
    status:     Optional[str] = Query(None),
    _current_user: str = Depends(get_current_user),
):
    """List all brand challenges, optionally filtered."""
    try:
        challenges = partnership_service.list_challenges(partner_id=partner_id, status=status)
        return [c.model_dump(mode="json") for c in challenges]
    except Exception as e:
        _err(500, "Failed to list challenges")


@router.get("/challenges/{challenge_id}", response_model=dict, summary="Get challenge")
async def get_challenge(
    challenge_id: str,
    _current_user: str = Depends(get_current_user),
):
    challenge = partnership_service.get_challenge(challenge_id)
    if not challenge:
        _err(404, f"Challenge {challenge_id!r} not found")
    return challenge.model_dump(mode="json")


@router.post("/challenges/{challenge_id}/join", response_model=dict, summary="Join a challenge")
async def join_challenge(
    challenge_id: str,
    current_user: dict = Depends(require_authenticated),
):
    """Authenticated user joins a brand challenge."""
    wallet = current_user.get("wallet", "")
    if not wallet:
        _err(401, "No wallet in session")
    try:
        participation = partnership_service.join_challenge(challenge_id, wallet)
        return {
            "success":          True,
            "participation_id": participation.participation_id,
            "challenge_id":     challenge_id,
            "wallet":           wallet,
        }
    except ValueError as e:
        _err(400, str(e))
    except Exception as e:
        logger.error("Join challenge error: %s", e, exc_info=True)
        _err(500, "Failed to join challenge")


@router.post("/challenges/{challenge_id}/submit", response_model=dict, summary="Submit post for challenge")
async def submit_challenge_post(
    challenge_id: str,
    post_cid: str = Body(..., embed=True),
    current_user: dict = Depends(require_authenticated),
):
    """Link a verified post to a challenge participation."""
    wallet = current_user.get("wallet", "")
    if not wallet:
        _err(401, "No wallet in session")
    try:
        participation = partnership_service.submit_challenge_post(challenge_id, wallet, post_cid)
        return {
            "success":      True,
            "challenge_id": challenge_id,
            "post_cid":     post_cid,
            "verified":     participation.verified,
        }
    except ValueError as e:
        _err(400, str(e))
    except Exception as e:
        _err(500, "Failed to submit post")


@router.get("/challenges/{challenge_id}/report", response_model=dict, summary="Challenge impact report")
async def get_challenge_report(
    challenge_id: str,
    _current_user: str = Depends(get_current_user),
):
    """
    Retrieve the blockchain-verified impact report for a brand challenge.
    Returned to the sponsoring company as their ESG proof.
    """
    try:
        return partnership_service.get_challenge_impact_report(challenge_id)
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        logger.error("Challenge report error: %s", e, exc_info=True)
        _err(500, "Failed to generate impact report")


@router.get("/challenges/{challenge_id}/leaderboard", response_model=dict, summary="Challenge leaderboard (task 6.5 & 6.10)")
async def get_challenge_leaderboard(
    challenge_id: str,
    limit: int = 50,
    _current_user: str = Depends(get_current_user),
):
    """
    Return the ranked leaderboard for a brand challenge.
    Shows top participants by ECO earned + verified actions.
    Falls back to seeded demo data when no real participants exist yet.
    """
    try:
        return partnership_service.get_challenge_leaderboard(challenge_id, limit=limit)
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        logger.error("Challenge leaderboard error: %s", e, exc_info=True)
        _err(500, "Failed to load leaderboard")



# ─── Corporate ESG Dashboard (Tier 2) ────────────────────────────────────────

@router.get("/esg/{partner_id}/dashboard", response_model=dict, summary="ESG dashboard stats")
async def get_esg_dashboard(
    partner_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Return aggregated ESG engagement stats for a corporate partner."""
    try:
        stats = partnership_service.get_esg_dashboard(partner_id)
        return stats.model_dump(mode="json")
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        logger.error("ESG dashboard error: %s", e, exc_info=True)
        _err(500, "Failed to load ESG dashboard")


@router.post("/esg/{partner_id}/report", response_model=dict, summary="Generate ESG report")
async def generate_esg_report(
    partner_id: str,
    req: ESGReportRequest,
    _current_user: str = Depends(get_current_user),
):
    """Generate a full ESG compliance report for the given period."""
    req.partner_id = partner_id  # enforce path param
    try:
        return partnership_service.generate_esg_report(req)
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        logger.error("ESG report error: %s", e, exc_info=True)
        _err(500, "Failed to generate ESG report")


# ─── School Program ───────────────────────────────────────────────────────────

@router.get("/school/{partner_id}/dashboard", response_model=dict, summary="School dashboard stats")
async def get_school_dashboard(
    partner_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Return aggregated eco-engagement stats for a school partner."""
    try:
        stats = partnership_service.get_school_dashboard(partner_id)
        return stats.model_dump(mode="json")
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        logger.error("School dashboard error: %s", e, exc_info=True)
        _err(500, "Failed to load school dashboard")


@router.post("/school/transcript", response_model=dict, summary="Generate Eco-Transcript")
async def generate_eco_transcript(
    req: EcoTranscriptRequest,
    _current_user: str = Depends(get_current_user),
):
    """
    Generate a blockchain-verified Eco-Transcript for a student.
    Can be used for college applications and community service documentation.
    """
    try:
        transcript = partnership_service.generate_eco_transcript(req)
        return transcript.model_dump(mode="json")
    except ValueError as e:
        _err(404, str(e))
    except Exception as e:
        logger.error("Eco-transcript error: %s", e, exc_info=True)
        _err(500, "Failed to generate eco-transcript")


# ─── Carbon Credit Packages (Tier 3) ─────────────────────────────────────────

@router.get("/carbon-packages/", response_model=list, summary="List carbon credit packages")
async def list_carbon_packages(_current_user: str = Depends(get_current_user)):
    """List all available Carbon Credit Packages."""
    try:
        pkgs = partnership_service.list_carbon_packages()
        return [p.model_dump(mode="json") for p in pkgs]
    except Exception as e:
        _err(500, "Failed to list carbon packages")


@router.post("/carbon-packages/", response_model=dict, status_code=201, summary="Create carbon credit package (admin)")
async def create_carbon_package(
    region: str           = Body(...),
    period: str           = Body(...),
    verified_actions: int = Body(...),
    co2_offset_kg: float  = Body(...),
    blockchain_proofs: List[str] = Body(default=[]),
    price_usd: float      = Body(...),
    eco_tokens: int       = Body(...),
    current_user: dict    = Depends(require_authenticated),
):
    """Admin action — bundle a new Carbon Credit Package from verified eco-action data."""
    try:
        pkg = partnership_service.create_carbon_package(
            region=region,
            period=period,
            verified_actions=verified_actions,
            co2_offset_kg=co2_offset_kg,
            blockchain_proofs=blockchain_proofs,
            price_usd=price_usd,
            eco_tokens=eco_tokens,
        )
        return {"success": True, **pkg.model_dump(mode="json")}
    except Exception as e:
        logger.error("Create carbon package error: %s", e, exc_info=True)
        _err(500, "Failed to create carbon package")


# ─── NGO Events ───────────────────────────────────────────────────────────────

@router.post("/ngo/events/", response_model=dict, status_code=201, summary="Create NGO event")
async def create_ngo_event(
    partner_id: str  = Body(...),
    title:      str  = Body(...),
    description: str = Body(...),
    location:   str  = Body(...),
    event_date: str  = Body(..., description="ISO datetime string"),
    max_volunteers: Optional[int] = Body(None),
    eco_per_volunteer: int        = Body(default=50),
    _current_user: str = Depends(get_current_user),
):
    """Create a large-scale eco-event for an NGO partner."""
    from datetime import datetime as dt
    try:
        event = partnership_service.create_ngo_event(
            partner_id       = partner_id,
            title            = title,
            description      = description,
            location         = location,
            event_date       = dt.fromisoformat(event_date),
            max_volunteers   = max_volunteers,
            eco_per_volunteer= eco_per_volunteer,
        )
        return {"success": True, **event.model_dump(mode="json")}
    except ValueError as e:
        _err(400, str(e))
    except Exception as e:
        logger.error("Create NGO event error: %s", e, exc_info=True)
        _err(500, "Failed to create NGO event")


@router.get("/ngo/events/", response_model=list, summary="List NGO events")
async def list_ngo_events(
    partner_id: Optional[str] = Query(None),
    _current_user: str        = Depends(get_current_user),
):
    """List NGO-hosted eco-events."""
    try:
        events = partnership_service.list_ngo_events(partner_id=partner_id)
        return [e.model_dump(mode="json") for e in events]
    except Exception as e:
        _err(500, "Failed to list NGO events")


# ─── Revenue Summary (admin) ──────────────────────────────────────────────────

@router.get("/revenue/{period}", response_model=dict, summary="Revenue summary (admin)")
async def get_revenue_summary(
    period: str,
    current_user: dict = Depends(require_authenticated),
):
    """Return platform-wide partnership revenue for the given period (admin only)."""
    try:
        summary = partnership_service.get_revenue_summary(period)
        return summary.model_dump(mode="json")
    except Exception as e:
        logger.error("Revenue summary error: %s", e, exc_info=True)
        _err(500, "Failed to load revenue summary")
