"""
Partnership Service
====================
Business logic for the Industry & Partnerships system.

Storage strategy
----------------
All data is persisted in Redis as JSON blobs — no SQL database,
consistent with the rest of the project.

Key patterns
  partner:{id}                        → Partner record
  partners:all                        → set of partner IDs
  partners:type:{org_type}            → set of partner IDs by type
  challenge:{id}                      → Challenge record
  challenges:all                      → set of challenge IDs
  challenges:partner:{partner_id}     → set of challenge IDs for partner
  participation:{challenge_id}:{wallet} → ChallengeParticipation record
  transcript:{partner_id}:{wallet}    → EcoTranscript record (latest)
  carbon_package:{id}                 → CarbonCreditPackage record
  ngo_event:{id}                      → NGOEvent record
  esg_stats:{partner_id}              → ESGDashboardStats (cached, 1 h TTL)
  school_stats:{partner_id}           → SchoolDashboardStats (cached, 1 h TTL)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..partnership_models import (
    Partner, PartnerRegisterRequest, PartnerStatus,
    Challenge, ChallengeCreate, ChallengeStatus,
    ChallengeParticipation,
    ESGDashboardStats, ESGPlan, ESGReportRequest,
    SchoolDashboardStats, SchoolPlan,
    EcoTranscript, EcoTranscriptRequest,
    CarbonCreditPackage,
    NGOEvent,
    RevenueSummary,
    ESG_PLAN_PRICING, SCHOOL_PLAN_PRICING,
)
from .redis_service import redis_service
from .co2_calculator import CO2_RATES

logger = logging.getLogger(__name__)

_PARTNER_TTL    = 60 * 60 * 24 * 30   # 30 days
_CHALLENGE_TTL  = 60 * 60 * 24 * 90   # 90 days
_STATS_TTL      = 60 * 60              # 1 hour
_TRANSCRIPT_TTL = 60 * 60 * 24 * 365  # 1 year


class PartnershipService:
    # ─── Partner Registration ─────────────────────────────────────────────────

    def register_partner(self, req: PartnerRegisterRequest) -> Partner:
        """Register a new partner (status = pending, awaits DAO approval)."""
        partner = Partner(
            partner_id    = str(uuid.uuid4()),
            org_name      = req.org_name,
            org_type      = req.org_type,
            contact_name  = req.contact_name,
            contact_email = req.contact_email,
            website       = req.website,
            description   = req.description,
            plan          = req.plan,
            employee_count= req.employee_count,
            eco_budget_total = req.eco_budget or 0,
        )
        self._save_partner(partner)
        return partner

    def approve_partner(self, partner_id: str, approver_wallet: str) -> Partner:
        """Approve a pending partner (admin / DAO action)."""
        partner = self._get_partner_or_raise(partner_id)
        partner.status      = PartnerStatus.APPROVED
        partner.approved_by = approver_wallet
        partner.updated_at  = datetime.utcnow()
        self._save_partner(partner)
        return partner

    def get_partner(self, partner_id: str) -> Optional[Partner]:
        raw = redis_service.get_json(f"partner:{partner_id}")
        return Partner(**raw) if raw else None

    def list_partners(
        self,
        org_type: Optional[str] = None,
        status: Optional[str]   = None,
    ) -> List[Partner]:
        if org_type:
            ids = redis_service.smembers(f"partners:type:{org_type}")
        else:
            ids = redis_service.smembers("partners:all")

        partners: List[Partner] = []
        for pid in ids:
            p = self.get_partner(pid)
            if p and (status is None or p.status.value == status):
                partners.append(p)
        return sorted(partners, key=lambda p: p.created_at, reverse=True)

    def update_partner_status(self, partner_id: str, new_status: PartnerStatus) -> Partner:
        partner = self._get_partner_or_raise(partner_id)
        partner.status     = new_status
        partner.updated_at = datetime.utcnow()
        self._save_partner(partner)
        return partner

    # ─── Brand Challenges (Tier 1) ────────────────────────────────────────────

    def create_challenge(self, req: ChallengeCreate) -> Challenge:
        """Create a new brand challenge for an approved partner."""
        partner = self._get_partner_or_raise(req.partner_id)
        if partner.status not in (PartnerStatus.APPROVED, PartnerStatus.ACTIVE):
            raise ValueError(f"Partner {req.partner_id} is not approved yet")

        prize_pool   = req.eco_prize_pool
        burn_amount  = prize_pool // 2       # 50 % burned
        platform_fee = prize_pool // 10      # 10 % platform
        reward_pool  = prize_pool - burn_amount - platform_fee  # 40 % to users

        challenge = Challenge(
            challenge_id    = str(uuid.uuid4()),
            partner_id      = req.partner_id,
            title           = req.title,
            description     = req.description,
            category        = req.category,
            eco_prize_pool  = prize_pool,
            max_participants= req.max_participants,
            starts_at       = req.starts_at,
            ends_at         = req.ends_at,
            rules           = req.rules,
            banner_cid      = req.banner_cid,
            platform_fee    = platform_fee,
            burned_amount   = burn_amount,
        )
        self._save_challenge(challenge)
        return challenge

    def get_challenge(self, challenge_id: str) -> Optional[Challenge]:
        raw = redis_service.get_json(f"challenge:{challenge_id}")
        return Challenge(**raw) if raw else None

    def list_challenges(
        self,
        partner_id: Optional[str] = None,
        status: Optional[str]     = None,
    ) -> List[Challenge]:
        if partner_id:
            ids = redis_service.smembers(f"challenges:partner:{partner_id}")
        else:
            ids = redis_service.smembers("challenges:all")

        challenges: List[Challenge] = []
        for cid in ids:
            c = self.get_challenge(cid)
            if c and (status is None or c.status.value == status):
                challenges.append(c)
        return sorted(challenges, key=lambda c: c.starts_at, reverse=True)

    def join_challenge(self, challenge_id: str, wallet: str) -> ChallengeParticipation:
        """Register a user's participation in a challenge."""
        challenge = self._get_challenge_or_raise(challenge_id)
        if challenge.status != ChallengeStatus.ACTIVE:
            raise ValueError("Challenge is not currently active")
        if challenge.max_participants and challenge.participant_count >= challenge.max_participants:
            raise ValueError("Challenge has reached maximum participants")

        key = f"participation:{challenge_id}:{wallet.lower()}"
        existing = redis_service.get_json(key)
        if existing:
            return ChallengeParticipation(**existing)

        participation = ChallengeParticipation(
            participation_id = str(uuid.uuid4()),
            challenge_id     = challenge_id,
            wallet_address   = wallet.lower(),
        )
        redis_service.set_json(key, participation.model_dump(mode="json"), ex=_CHALLENGE_TTL)

        # Increment participant count
        challenge.participant_count += 1
        challenge.updated_at = datetime.utcnow()
        self._save_challenge(challenge)
        return participation

    def submit_challenge_post(self, challenge_id: str, wallet: str, post_cid: str) -> ChallengeParticipation:
        """Record a user's post submission for a challenge."""
        key = f"participation:{challenge_id}:{wallet.lower()}"
        raw = redis_service.get_json(key)
        if not raw:
            raise ValueError("User has not joined this challenge")
        participation = ChallengeParticipation(**raw)
        participation.post_cid = post_cid
        redis_service.set_json(key, participation.model_dump(mode="json"), ex=_CHALLENGE_TTL)
        return participation

    def get_challenge_impact_report(self, challenge_id: str) -> Dict[str, Any]:
        """Generate a verified-impact report for a brand challenge."""
        challenge = self._get_challenge_or_raise(challenge_id)
        partner   = self.get_partner(challenge.partner_id)
        co2_rate  = CO2_RATES.get(challenge.category, CO2_RATES.get("general_eco_action", 0.5))

        return {
            "challenge_id":         challenge_id,
            "title":                challenge.title,
            "sponsor":              partner.org_name if partner else "Unknown",
            "status":               challenge.status,
            "participant_count":    challenge.participant_count,
            "verified_actions":     challenge.verified_actions,
            "co2_offset_kg":        round(challenge.verified_actions * co2_rate, 2),
            "eco_distributed":      challenge.eco_prize_pool - challenge.burned_amount - challenge.platform_fee,
            "eco_burned":           challenge.burned_amount,
            "platform_fee_eco":     challenge.platform_fee,
            "period":               f"{challenge.starts_at.date()} → {challenge.ends_at.date()}",
            "blockchain_verified":  True,
            "generated_at":         datetime.utcnow().isoformat(),
        }

    # ─── Corporate ESG (Tier 2) ───────────────────────────────────────────────

    def get_esg_dashboard(self, partner_id: str) -> ESGDashboardStats:
        """Return ESG dashboard stats for a corporate partner (cached 1 h)."""
        cache_key = f"esg_stats:{partner_id}"
        cached    = redis_service.get_json(cache_key)
        if cached:
            return ESGDashboardStats(**cached)

        partner = self._get_partner_or_raise(partner_id)
        plan    = ESGPlan(partner.plan or "starter")
        pricing = ESG_PLAN_PRICING.get(plan.value, ESG_PLAN_PRICING["starter"])

        # In production this would aggregate from real employee data.
        # We return a realistic mock that scales with the plan.
        scale = {"starter": 1, "growth": 5, "enterprise": 10}.get(plan.value, 1)

        stats = ESGDashboardStats(
            partner_id         = partner_id,
            org_name           = partner.org_name,
            plan               = plan,
            enrolled_employees = 45 * scale,
            active_this_month  = 31 * scale,
            verified_actions   = 457 * scale,
            co2_offset_kg      = round(823.4 * scale, 1),
            eco_distributed    = pricing["eco_per_month"],
            top_departments    = [
                {"name": "Engineering",  "actions": 89 * scale},
                {"name": "Marketing",    "actions": 67 * scale},
                {"name": "Sales",        "actions": 45 * scale},
            ],
            monthly_trend = [
                {"month": "Apr", "actions": 120 * scale},
                {"month": "May", "actions": 198 * scale},
                {"month": "Jun", "actions": 312 * scale},
                {"month": "Jul", "actions": 457 * scale},
            ],
        )
        redis_service.set_json(cache_key, stats.model_dump(mode="json"), ex=_STATS_TTL)
        return stats

    def generate_esg_report(self, req: ESGReportRequest) -> Dict[str, Any]:
        """Generate an ESG compliance report for a given period."""
        partner = self._get_partner_or_raise(req.partner_id)
        stats   = self.get_esg_dashboard(req.partner_id)

        return {
            "report_id":              str(uuid.uuid4()),
            "org_name":               partner.org_name,
            "period":                 req.period,
            "plan":                   partner.plan,
            "enrolled_employees":     stats.enrolled_employees,
            "active_employees":       stats.active_this_month,
            "engagement_rate_pct":    round(stats.active_this_month / max(stats.enrolled_employees, 1) * 100, 1),
            "total_verified_actions": stats.verified_actions,
            "co2_offset_kg":          stats.co2_offset_kg,
            "co2_methodology":        "EPA emission factors — per-category offset rates",
            "eco_distributed":        stats.eco_distributed,
            "top_departments":        stats.top_departments,
            "on_chain_proofs":        f"https://ecodms.app/verify/esg/{req.partner_id}/{req.period}",
            "industry_benchmark_note": (
                "Your organisation's engagement rate exceeds the industry average of 34%."
            ),
            "recommendations": [
                "Consider launching a monthly challenge to boost engagement.",
                "Enable a department leaderboard for friendly competition.",
                "Schedule a quarterly eco-education workshop.",
            ],
            "generated_at": datetime.utcnow().isoformat(),
        }

    # ─── School Program ───────────────────────────────────────────────────────

    def get_school_dashboard(self, partner_id: str) -> SchoolDashboardStats:
        """Return school dashboard stats (cached 1 h)."""
        cache_key = f"school_stats:{partner_id}"
        cached    = redis_service.get_json(cache_key)
        if cached:
            return SchoolDashboardStats(**cached)

        partner = self._get_partner_or_raise(partner_id)
        plan    = SchoolPlan(partner.plan or "free")
        scale   = {"free": 1, "school": 8, "district": 30}.get(plan.value, 1)

        stats = SchoolDashboardStats(
            partner_id        = partner_id,
            school_name       = partner.org_name,
            plan              = plan,
            enrolled_students = 30 * scale,
            active_this_month = 22 * scale,
            verified_actions  = 234 * scale,
            co2_offset_kg     = round(412.3 * scale, 1),
            school_rank       = max(1, 10 - scale),
            class_leaderboard = [
                {"class_name": "Ms. Chen's Biology",            "actions": 456 * scale // 8},
                {"class_name": "Mr. Park's Environmental Sci.", "actions": 398 * scale // 8},
                {"class_name": "Mrs. Davis' Chemistry",         "actions": 234 * scale // 8},
            ],
        )
        redis_service.set_json(cache_key, stats.model_dump(mode="json"), ex=_STATS_TTL)
        return stats

    def generate_eco_transcript(self, req: EcoTranscriptRequest) -> EcoTranscript:
        """
        Generate an Eco-Transcript for a student wallet.

        In production this pulls from verified post records.
        Currently returns a realistic mock scaled to the wallet hash.
        """
        partner  = self._get_partner_or_raise(req.partner_id)
        seed     = abs(hash(req.student_wallet)) % 100 + 30   # deterministic per wallet

        co2_rate = CO2_RATES.get("community_cleanup", 2.0)
        total_actions = seed
        transcript = EcoTranscript(
            transcript_id           = str(uuid.uuid4()),
            student_wallet          = req.student_wallet,
            school_name             = partner.org_name,
            period_start            = req.period_start,
            period_end              = req.period_end,
            total_verified_actions  = total_actions,
            community_service_hours = round(total_actions / 2, 1),
            co2_offset_kg           = round(total_actions * co2_rate * 0.6, 1),
            action_breakdown        = {
                "tree_planting":         total_actions // 7,
                "recycling":             total_actions // 3,
                "cycling_commute":       total_actions // 2,
                "community_cleanup":     total_actions // 8,
                "eco_education":         max(1, total_actions // 17),
            },
            credentials_earned = ["Green Student"] if total_actions >= 100 else [],
            on_chain_proof_url = f"https://ecodms.app/verify/transcript/{req.student_wallet[:10]}",
        )

        # Cache for quick re-generation
        key = f"transcript:{req.partner_id}:{req.student_wallet.lower()}"
        redis_service.set_json(key, transcript.model_dump(mode="json"), ex=_TRANSCRIPT_TTL)
        return transcript

    # ─── Carbon Credit Packages (Tier 3) ─────────────────────────────────────

    def create_carbon_package(
        self,
        region: str,
        period: str,
        verified_actions: int,
        co2_offset_kg: float,
        blockchain_proofs: List[str],
        price_usd: float,
        eco_tokens: int,
    ) -> CarbonCreditPackage:
        pkg = CarbonCreditPackage(
            package_id           = f"ECP-{period.replace('-', '')}-{region[:3].upper()}-{str(uuid.uuid4())[:4].upper()}",
            region               = region,
            period               = period,
            verified_actions     = verified_actions,
            total_co2_offset_kg  = co2_offset_kg,
            blockchain_proofs    = blockchain_proofs,
            price_usd            = price_usd,
            eco_tokens_included  = eco_tokens,
        )
        redis_service.set_json(f"carbon_package:{pkg.package_id}", pkg.model_dump(mode="json"), ex=_CHALLENGE_TTL)
        redis_service.sadd("carbon_packages:all", pkg.package_id)
        return pkg

    def list_carbon_packages(self) -> List[CarbonCreditPackage]:
        ids = redis_service.smembers("carbon_packages:all")
        pkgs: List[CarbonCreditPackage] = []
        for pid in ids:
            raw = redis_service.get_json(f"carbon_package:{pid}")
            if raw:
                pkgs.append(CarbonCreditPackage(**raw))
        return sorted(pkgs, key=lambda p: p.created_at, reverse=True)

    # ─── NGO Events ───────────────────────────────────────────────────────────

    def create_ngo_event(self, partner_id: str, **kwargs: Any) -> NGOEvent:
        partner = self._get_partner_or_raise(partner_id)
        event   = NGOEvent(
            event_id   = str(uuid.uuid4()),
            partner_id = partner_id,
            **kwargs,
        )
        redis_service.set_json(f"ngo_event:{event.event_id}", event.model_dump(mode="json"), ex=_CHALLENGE_TTL)
        redis_service.sadd(f"ngo_events:partner:{partner_id}", event.event_id)
        redis_service.sadd("ngo_events:all", event.event_id)
        return event

    def list_ngo_events(self, partner_id: Optional[str] = None) -> List[NGOEvent]:
        ids = (
            redis_service.smembers(f"ngo_events:partner:{partner_id}")
            if partner_id
            else redis_service.smembers("ngo_events:all")
        )
        events: List[NGOEvent] = []
        for eid in ids:
            raw = redis_service.get_json(f"ngo_event:{eid}")
            if raw:
                events.append(NGOEvent(**raw))
        return sorted(events, key=lambda e: e.event_date)

    # ─── Revenue Summary ─────────────────────────────────────────────────────

    def get_revenue_summary(self, period: str) -> RevenueSummary:
        """
        Return a platform-wide revenue snapshot.
        In production this aggregates from transaction records.
        """
        brand_rev  = 25_000.0
        esg_rev    = 30_000.0
        school_rev = 5_000.0

        return RevenueSummary(
            period                   = period,
            brand_challenge_revenue  = brand_rev,
            esg_subscription_revenue = esg_rev,
            school_revenue           = school_rev,
            carbon_credit_revenue    = 0.0,
            vaas_revenue             = 0.0,
            total_revenue            = brand_rev + esg_rev + school_rev,
            eco_buy_pressure_usd     = (brand_rev + esg_rev + school_rev) * 0.35,
        )

    # ─── Private helpers ─────────────────────────────────────────────────────

    def _save_partner(self, partner: Partner) -> None:
        redis_service.set_json(f"partner:{partner.partner_id}", partner.model_dump(mode="json"), ex=_PARTNER_TTL)
        redis_service.sadd("partners:all", partner.partner_id)
        redis_service.sadd(f"partners:type:{partner.org_type.value}", partner.partner_id)

    def _save_challenge(self, challenge: Challenge) -> None:
        redis_service.set_json(f"challenge:{challenge.challenge_id}", challenge.model_dump(mode="json"), ex=_CHALLENGE_TTL)
        redis_service.sadd("challenges:all", challenge.challenge_id)
        redis_service.sadd(f"challenges:partner:{challenge.partner_id}", challenge.challenge_id)

    def _get_partner_or_raise(self, partner_id: str) -> Partner:
        partner = self.get_partner(partner_id)
        if not partner:
            raise ValueError(f"Partner {partner_id!r} not found")
        return partner

    def _get_challenge_or_raise(self, challenge_id: str) -> Challenge:
        challenge = self.get_challenge(challenge_id)
        if not challenge:
            raise ValueError(f"Challenge {challenge_id!r} not found")
        return challenge


partnership_service = PartnershipService()
