"""
Partnership Models
==================
Pydantic models for the Industry & Partnerships system.

Covers:
  - Tier 1: Brand Challenge Partners
  - Tier 2: Corporate ESG Partners
  - Tier 3: Carbon Credit Packages
  - School / University Programs
  - NGO Partnerships
  - Government Partnerships

All data is stored in Redis (fast cache) and serialised as JSON.
No traditional database — consistent with the rest of the project.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ─── Enums ───────────────────────────────────────────────────────────────────

class PartnerType(str, Enum):
    BRAND          = "brand"
    CORPORATE_ESG  = "corporate_esg"
    SCHOOL         = "school"
    NGO            = "ngo"
    GOVERNMENT     = "government"
    CARBON_CREDIT  = "carbon_credit"


class PartnerStatus(str, Enum):
    PENDING   = "pending"
    APPROVED  = "approved"
    ACTIVE    = "active"
    SUSPENDED = "suspended"
    EXPIRED   = "expired"


class ChallengeStatus(str, Enum):
    DRAFT     = "draft"
    ACTIVE    = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ESGPlan(str, Enum):
    STARTER    = "starter"
    GROWTH     = "growth"
    ENTERPRISE = "enterprise"


class SchoolPlan(str, Enum):
    FREE     = "free"
    SCHOOL   = "school"
    DISTRICT = "district"


# ─── Partner Registration ──────────────────────────────────────────────────────

class PartnerRegisterRequest(BaseModel):
    """Payload sent when a company / school / NGO applies for partnership."""
    org_name:     str            = Field(..., min_length=2, max_length=120, description="Organisation name")
    org_type:     PartnerType   = Field(..., description="Type of partnership")
    contact_name: str            = Field(..., description="Primary contact full name")
    contact_email: str           = Field(..., description="Primary contact email")
    website:      Optional[str]  = Field(None, description="Organisation website")
    description:  Optional[str]  = Field(None, max_length=1000, description="Brief description / pitch")
    # ESG-specific
    plan:         Optional[ESGPlan | SchoolPlan] = Field(None, description="Subscription plan (ESG or School)")
    employee_count: Optional[int] = Field(None, description="Number of employees (ESG partners)")
    # Brand-specific
    challenge_idea: Optional[str] = Field(None, max_length=500, description="Proposed challenge idea")
    eco_budget:   Optional[int]   = Field(None, description="ECO token budget for challenge")


class Partner(BaseModel):
    """Stored partner record."""
    partner_id:    str           = Field(..., description="UUID")
    org_name:      str
    org_type:      PartnerType
    contact_name:  str
    contact_email: str
    website:       Optional[str] = None
    description:   Optional[str] = None
    status:        PartnerStatus = PartnerStatus.PENDING
    plan:          Optional[str] = None
    employee_count: Optional[int] = None
    eco_budget_total: int        = Field(default=0, description="Total ECO tokens committed")
    created_at:    datetime      = Field(default_factory=datetime.utcnow)
    updated_at:    datetime      = Field(default_factory=datetime.utcnow)
    approved_by:   Optional[str] = Field(None, description="DAO / admin wallet that approved")


# ─── Tier 1 – Brand Challenges ─────────────────────────────────────────────────

class ChallengeCreate(BaseModel):
    """Create a sponsored brand challenge."""
    partner_id:    str            = Field(..., description="Sponsoring partner ID")
    title:         str            = Field(..., min_length=5, max_length=120)
    description:   str            = Field(..., min_length=10, max_length=2000)
    category:      str            = Field(..., description="Eco-action category slug")
    eco_prize_pool: int           = Field(..., gt=0, description="Total ECO tokens for prize pool")
    max_participants: Optional[int] = Field(None, description="Participant cap (None = unlimited)")
    starts_at:     datetime       = Field(..., description="Challenge start time (UTC)")
    ends_at:       datetime       = Field(..., description="Challenge end time (UTC)")
    rules:         Optional[str]  = Field(None, max_length=3000)
    banner_cid:    Optional[str]  = Field(None, description="IPFS CID of challenge banner image")


class Challenge(ChallengeCreate):
    """Full challenge record (stored in Redis)."""
    challenge_id:      str           = Field(..., description="UUID")
    status:            ChallengeStatus = ChallengeStatus.DRAFT
    participant_count: int           = Field(default=0)
    verified_actions:  int           = Field(default=0)
    co2_offset_kg:     float         = Field(default=0.0)
    platform_fee:      int           = Field(default=0, description="10 % platform fee in ECO")
    burned_amount:     int           = Field(default=0, description="50 % burn amount in ECO")
    created_at:        datetime      = Field(default_factory=datetime.utcnow)
    updated_at:        datetime      = Field(default_factory=datetime.utcnow)


class ChallengeParticipation(BaseModel):
    """Record of a user joining + submitting to a challenge."""
    participation_id: str     = Field(..., description="UUID")
    challenge_id:     str
    wallet_address:   str
    post_cid:         Optional[str] = None
    verified:         bool          = False
    eco_earned:       int           = Field(default=0)
    joined_at:        datetime      = Field(default_factory=datetime.utcnow)


# ─── Tier 2 – Corporate ESG Dashboard ─────────────────────────────────────────

ESG_PLAN_PRICING: Dict[str, Dict[str, Any]] = {
    "starter": {
        "price_usd_month": 500,
        "max_employees": 100,
        "eco_per_month": 2000,
        "features": ["Basic dashboard", "Monthly reports"],
    },
    "growth": {
        "price_usd_month": 2000,
        "max_employees": 500,
        "eco_per_month": 10_000,
        "features": ["Full dashboard", "Weekly reports", "Challenges"],
    },
    "enterprise": {
        "price_usd_month": 5000,
        "max_employees": None,   # unlimited
        "eco_per_month": 30_000,
        "features": ["Custom branding", "API access", "Dedicated support"],
    },
}

class ESGDashboardStats(BaseModel):
    """Aggregated ESG stats for a corporate partner dashboard."""
    partner_id:          str
    org_name:            str
    plan:                ESGPlan
    enrolled_employees:  int   = 0
    active_this_month:   int   = 0
    verified_actions:    int   = 0
    co2_offset_kg:       float = 0.0
    eco_distributed:     int   = 0
    top_departments:     List[Dict[str, Any]] = Field(default_factory=list)
    monthly_trend:       List[Dict[str, Any]] = Field(default_factory=list)
    as_of:               datetime = Field(default_factory=datetime.utcnow)


class ESGReportRequest(BaseModel):
    """Request to generate an ESG PDF / JSON report."""
    partner_id: str
    period:     str = Field(..., description="e.g. 'Q2-2026' or '2026-07'")
    format:     str = Field(default="json", description="'json' or 'pdf'")


# ─── School Program ───────────────────────────────────────────────────────────

SCHOOL_PLAN_PRICING: Dict[str, Dict[str, Any]] = {
    "free":     {"price_usd_month": 0,   "max_students": 30,   "features": ["Basic challenge", "Student portfolios"]},
    "school":   {"price_usd_month": 50,  "max_students": 500,  "features": ["Dashboard", "Eco-transcripts", "Leaderboard"]},
    "district": {"price_usd_month": 200, "max_students": None, "features": ["Multi-school dashboard", "District leaderboard", "API"]},
}

class SchoolDashboardStats(BaseModel):
    """Aggregated stats for a school partner."""
    partner_id:         str
    school_name:        str
    plan:               SchoolPlan
    enrolled_students:  int   = 0
    active_this_month:  int   = 0
    verified_actions:   int   = 0
    co2_offset_kg:      float = 0.0
    school_rank:        Optional[int] = None
    class_leaderboard:  List[Dict[str, Any]] = Field(default_factory=list)
    as_of:              datetime = Field(default_factory=datetime.utcnow)


class EcoTranscriptRequest(BaseModel):
    """Request to generate an Eco-Transcript for a student."""
    partner_id:     str   = Field(..., description="School partner ID")
    student_wallet: str   = Field(..., description="Student's wallet address")
    period_start:   str   = Field(..., description="ISO date, e.g. '2025-09-01'")
    period_end:     str   = Field(..., description="ISO date, e.g. '2026-06-30'")


class EcoTranscript(BaseModel):
    """Generated Eco-Transcript data."""
    transcript_id:        str
    student_wallet:       str
    student_name:         Optional[str]     = None
    school_name:          str
    period_start:         str
    period_end:           str
    total_verified_actions: int             = 0
    community_service_hours: float          = 0.0   # actions / 2
    co2_offset_kg:        float             = 0.0
    action_breakdown:     Dict[str, int]    = Field(default_factory=dict)
    credentials_earned:   List[str]         = Field(default_factory=list)
    verification_note:    str               = "All actions verified by ML (≥93% confidence) and community consensus"
    on_chain_proof_url:   Optional[str]     = None
    generated_at:         datetime          = Field(default_factory=datetime.utcnow)


# ─── Tier 3 – Carbon Credit Packages ─────────────────────────────────────────

class CarbonCreditPackage(BaseModel):
    """Bundled eco-action data product sold to carbon credit buyers."""
    package_id:          str
    region:              str
    period:              str                    = Field(..., description="e.g. 'Q2-2026'")
    verified_actions:    int                    = 0
    total_co2_offset_kg: float                  = 0.0
    verification_method: str                    = "ML (3-model ensemble) + community voting"
    blockchain_proofs:   List[str]              = Field(default_factory=list)
    ipfs_data_archive:   Optional[str]          = None
    price_usd:           float                  = 0.0
    eco_tokens_included: int                    = 0
    methodology:         str                    = "EPA emission factors, IPCC guidelines"
    status:              str                    = "available"
    created_at:          datetime               = Field(default_factory=datetime.utcnow)


# ─── NGO Partner ─────────────────────────────────────────────────────────────

class NGOEvent(BaseModel):
    """Large-scale eco-event posted by an NGO partner."""
    event_id:       str
    partner_id:     str
    title:          str
    description:    str
    location:       str
    event_date:     datetime
    qr_code_id:     Optional[str]  = None   # GPS + timestamp QR check-in
    max_volunteers: Optional[int]  = None
    volunteer_count: int           = 0
    verified_count:  int           = 0
    eco_per_volunteer: int         = Field(default=50, description="ECO tokens per verified volunteer")
    status:         str            = "upcoming"
    created_at:     datetime       = Field(default_factory=datetime.utcnow)


# ─── Revenue Summary ──────────────────────────────────────────────────────────

class RevenueSummary(BaseModel):
    """Platform-wide partnership revenue snapshot."""
    period:                   str
    brand_challenge_revenue:  float = 0.0
    esg_subscription_revenue: float = 0.0
    school_revenue:           float = 0.0
    carbon_credit_revenue:    float = 0.0
    vaas_revenue:             float = 0.0    # Verification-as-a-Service
    total_revenue:            float = 0.0
    eco_buy_pressure_usd:     float = 0.0   # ECO bought from market by partners
    as_of:                    datetime = Field(default_factory=datetime.utcnow)
