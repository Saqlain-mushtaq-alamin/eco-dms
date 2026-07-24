"""
Tests for Industry & Partnerships — partnership_service.py
============================================================
Runs fully offline:
  - Redis is mocked via an in-memory dict.
  - No network calls, no real DB.

Run with:
    cd backend
    python -m pytest tests/test_partnership_service.py -v
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Set
from unittest.mock import MagicMock, patch

import pytest

# ─── In-memory Redis mock ─────────────────────────────────────────────────────

class _FakeRedis:
    """Minimal in-memory Redis stand-in for unit tests."""

    def __init__(self):
        self._store: Dict[str, str]      = {}
        self._sets:  Dict[str, Set[str]] = {}

    def set_json(self, key: str, value: Any, ex: Optional[int] = None):
        self._store[key] = json.dumps(value)

    def get_json(self, key: str) -> Optional[Any]:
        raw = self._store.get(key)
        return json.loads(raw) if raw else None

    def set_str(self, key: str, value: str, ex: Optional[int] = None):
        self._store[key] = value

    def get_str(self, key: str) -> Optional[str]:
        return self._store.get(key)

    def delete(self, key: str):
        self._store.pop(key, None)

    def sadd(self, key: str, *values: str) -> int:
        self._sets.setdefault(key, set()).update(values)
        return len(values)

    def smembers(self, key: str) -> Set[str]:
        return self._sets.get(key, set())

    def ping(self) -> bool:
        return True


_fake_redis = _FakeRedis()


# ─── Patch redis_service before importing the service ────────────────────────
# We patch at module level so the partnership_service singleton uses our mock.

import sys
import types

# Build a stub for app.services.redis_service
_redis_stub = types.ModuleType("app.services.redis_service")
_redis_stub.redis_service = _fake_redis  # type: ignore[attr-defined]
sys.modules.setdefault("app.services.redis_service", _redis_stub)

# Also stub app.config
_redis_stub2 = types.ModuleType("app.config")
_settings_stub = MagicMock()
_redis_stub2.settings = _settings_stub  # type: ignore[attr-defined]
sys.modules.setdefault("app.config", _redis_stub2)

from app.services.partnership_service import PartnershipService  # noqa: E402
from app.partnership_models import (  # noqa: E402
    ChallengeCreate, ChallengeStatus, EcoTranscriptRequest,
    ESGReportRequest, PartnerRegisterRequest, PartnerStatus, PartnerType,
)


@pytest.fixture(autouse=True)
def fresh_service():
    """Return a fresh PartnershipService with a clean Redis store for each test."""
    _fake_redis._store.clear()
    _fake_redis._sets.clear()
    yield PartnershipService()


# ─── Partner Registration ─────────────────────────────────────────────────────

class TestPartnerRegistration:
    def test_register_brand_partner(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name      = "Patagonia",
            org_type      = PartnerType.BRAND,
            contact_name  = "Jane Doe",
            contact_email = "jane@patagonia.com",
            challenge_idea= "Repair, Don't Replace",
            eco_budget    = 10_000,
        )
        partner = svc.register_partner(req)

        assert partner.partner_id
        assert partner.org_name == "Patagonia"
        assert partner.status   == PartnerStatus.PENDING
        assert partner.eco_budget_total == 10_000

    def test_register_esg_partner(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name       = "TechCorp Inc.",
            org_type       = PartnerType.CORPORATE_ESG,
            contact_name   = "Bob Smith",
            contact_email  = "bob@techcorp.com",
            plan           = "growth",
            employee_count = 450,
        )
        partner = svc.register_partner(req)
        assert partner.status   == PartnerStatus.PENDING
        assert partner.org_type == PartnerType.CORPORATE_ESG

    def test_register_school_partner(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name      = "Portland High School",
            org_type      = PartnerType.SCHOOL,
            contact_name  = "Principal Adams",
            contact_email = "principal@phs.edu",
            plan          = "school",
        )
        partner = svc.register_partner(req)
        assert partner.org_type == PartnerType.SCHOOL
        assert partner.plan     == "school"

    def test_approve_partner(self, fresh_service):
        svc  = fresh_service
        req  = PartnerRegisterRequest(
            org_name="REI", org_type=PartnerType.BRAND,
            contact_name="Alice", contact_email="alice@rei.com",
        )
        partner = svc.register_partner(req)
        approved = svc.approve_partner(partner.partner_id, "0xAdminWallet")

        assert approved.status      == PartnerStatus.APPROVED
        assert approved.approved_by == "0xAdminWallet"

    def test_approve_nonexistent_partner_raises(self, fresh_service):
        svc = fresh_service
        with pytest.raises(ValueError, match="not found"):
            svc.approve_partner("nonexistent-id", "0xAdmin")

    def test_list_partners_by_type(self, fresh_service):
        svc = fresh_service
        for name, ptype in [("BrandA", PartnerType.BRAND), ("EsgA", PartnerType.CORPORATE_ESG)]:
            svc.register_partner(PartnerRegisterRequest(
                org_name=name, org_type=ptype,
                contact_name="X", contact_email="x@x.com",
            ))

        brands = svc.list_partners(org_type="brand")
        assert len(brands) == 1
        assert brands[0].org_name == "BrandA"

    def test_update_partner_status(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name="Whole Foods", org_type=PartnerType.BRAND,
            contact_name="C", contact_email="c@wf.com",
        )
        partner = svc.register_partner(req)
        updated = svc.update_partner_status(partner.partner_id, PartnerStatus.SUSPENDED)
        assert updated.status == PartnerStatus.SUSPENDED


# ─── Brand Challenges ─────────────────────────────────────────────────────────

class TestBrandChallenges:
    def _approved_partner(self, svc):
        req = PartnerRegisterRequest(
            org_name="REI", org_type=PartnerType.BRAND,
            contact_name="A", contact_email="a@rei.com",
        )
        partner = svc.register_partner(req)
        return svc.approve_partner(partner.partner_id, "0xAdmin")

    def _challenge_req(self, partner_id: str) -> ChallengeCreate:
        return ChallengeCreate(
            partner_id    = partner_id,
            title         = "Trail Cleanup Sprint",
            description   = "Pick up trash on local trails and post verified photos.",
            category      = "community_cleanup",
            eco_prize_pool= 15_000,
            starts_at     = datetime.utcnow(),
            ends_at       = datetime.utcnow() + timedelta(days=30),
        )

    def test_create_challenge_success(self, fresh_service):
        svc     = fresh_service
        partner = self._approved_partner(svc)
        req     = self._challenge_req(partner.partner_id)
        challenge = svc.create_challenge(req)

        assert challenge.challenge_id
        assert challenge.eco_prize_pool == 15_000
        assert challenge.burned_amount  == 7_500   # 50 %
        assert challenge.platform_fee   == 1_500   # 10 %

    def test_create_challenge_pending_partner_raises(self, fresh_service):
        svc = fresh_service
        req_p = PartnerRegisterRequest(
            org_name="Pending Corp", org_type=PartnerType.BRAND,
            contact_name="P", contact_email="p@p.com",
        )
        pending = svc.register_partner(req_p)
        req_c   = self._challenge_req(pending.partner_id)
        with pytest.raises(ValueError, match="not approved"):
            svc.create_challenge(req_c)

    def test_join_challenge_registers_user(self, fresh_service):
        svc       = fresh_service
        partner   = self._approved_partner(svc)
        challenge = svc.create_challenge(self._challenge_req(partner.partner_id))

        # Make challenge ACTIVE
        challenge.status = ChallengeStatus.ACTIVE
        svc._save_challenge(challenge)

        participation = svc.join_challenge(challenge.challenge_id, "0xUserWallet")
        assert participation.wallet_address == "0xuserwallet"  # lowercased

    def test_join_challenge_idempotent(self, fresh_service):
        svc       = fresh_service
        partner   = self._approved_partner(svc)
        challenge = svc.create_challenge(self._challenge_req(partner.partner_id))
        challenge.status = ChallengeStatus.ACTIVE
        svc._save_challenge(challenge)

        p1 = svc.join_challenge(challenge.challenge_id, "0xUser")
        p2 = svc.join_challenge(challenge.challenge_id, "0xUser")
        assert p1.participation_id == p2.participation_id

    def test_submit_challenge_post(self, fresh_service):
        svc       = fresh_service
        partner   = self._approved_partner(svc)
        challenge = svc.create_challenge(self._challenge_req(partner.partner_id))
        challenge.status = ChallengeStatus.ACTIVE
        svc._save_challenge(challenge)

        svc.join_challenge(challenge.challenge_id, "0xUser2")
        participation = svc.submit_challenge_post(challenge.challenge_id, "0xUser2", "QmTestCid123")
        assert participation.post_cid == "QmTestCid123"

    def test_challenge_impact_report_keys(self, fresh_service):
        svc       = fresh_service
        partner   = self._approved_partner(svc)
        challenge = svc.create_challenge(self._challenge_req(partner.partner_id))

        report = svc.get_challenge_impact_report(challenge.challenge_id)
        for key in ("challenge_id", "title", "sponsor", "participant_count",
                    "verified_actions", "co2_offset_kg", "eco_burned",
                    "platform_fee_eco", "blockchain_verified"):
            assert key in report, f"Missing key: {key}"

    def test_list_challenges_for_partner(self, fresh_service):
        svc     = fresh_service
        p1      = self._approved_partner(svc)
        svc.create_challenge(self._challenge_req(p1.partner_id))
        svc.create_challenge(self._challenge_req(p1.partner_id))
        challenges = svc.list_challenges(partner_id=p1.partner_id)
        assert len(challenges) == 2


# ─── ESG Dashboard ───────────────────────────────────────────────────────────

class TestESGDashboard:
    def test_esg_dashboard_returns_stats(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name="TechCorp", org_type=PartnerType.CORPORATE_ESG,
            contact_name="B", contact_email="b@tc.com", plan="growth",
        )
        partner = svc.register_partner(req)
        stats   = svc.get_esg_dashboard(partner.partner_id)

        assert stats.org_name          == "TechCorp"
        assert stats.enrolled_employees > 0
        assert stats.co2_offset_kg     > 0
        assert len(stats.top_departments) == 3

    def test_esg_report_has_all_keys(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name="MegaCorp", org_type=PartnerType.CORPORATE_ESG,
            contact_name="C", contact_email="c@mc.com", plan="enterprise",
        )
        partner = svc.register_partner(req)
        report  = svc.generate_esg_report(
            ESGReportRequest(partner_id=partner.partner_id, period="Q2-2026")
        )

        for key in ("report_id", "org_name", "period", "co2_offset_kg",
                    "on_chain_proofs", "recommendations"):
            assert key in report, f"Missing key: {key}"

    def test_esg_dashboard_cached(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name="CacheCorp", org_type=PartnerType.CORPORATE_ESG,
            contact_name="D", contact_email="d@cc.com", plan="starter",
        )
        partner = svc.register_partner(req)
        s1 = svc.get_esg_dashboard(partner.partner_id)
        s2 = svc.get_esg_dashboard(partner.partner_id)
        # Second call must hit cache — same as_of timestamp
        assert s1.as_of == s2.as_of


# ─── School Program ───────────────────────────────────────────────────────────

class TestSchoolProgram:
    def test_school_dashboard_stats(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name="Portland High", org_type=PartnerType.SCHOOL,
            contact_name="P", contact_email="p@phs.edu", plan="school",
        )
        partner = svc.register_partner(req)
        stats   = svc.get_school_dashboard(partner.partner_id)

        assert stats.school_name       == "Portland High"
        assert stats.enrolled_students > 0
        assert len(stats.class_leaderboard) == 3

    def test_eco_transcript_generation(self, fresh_service):
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name="River Valley School", org_type=PartnerType.SCHOOL,
            contact_name="T", contact_email="t@rvs.edu", plan="school",
        )
        partner    = svc.register_partner(req)
        t_req      = EcoTranscriptRequest(
            partner_id    = partner.partner_id,
            student_wallet= "0xStudentABC",
            period_start  = "2025-09-01",
            period_end    = "2026-06-30",
        )
        transcript = svc.generate_eco_transcript(t_req)

        assert transcript.school_name             == "River Valley School"
        assert transcript.total_verified_actions  > 0
        assert transcript.community_service_hours > 0
        assert transcript.co2_offset_kg           > 0
        assert transcript.on_chain_proof_url

    def test_eco_transcript_deterministic(self, fresh_service):
        """Same wallet should produce same action count (hash-based seed)."""
        svc = fresh_service
        req = PartnerRegisterRequest(
            org_name="Test School", org_type=PartnerType.SCHOOL,
            contact_name="X", contact_email="x@ts.edu", plan="free",
        )
        partner = svc.register_partner(req)
        t_req = EcoTranscriptRequest(
            partner_id="x", student_wallet="0xAlwaysSameWallet",
            period_start="2025-09-01", period_end="2026-06-30",
        )
        t_req.partner_id = partner.partner_id
        t1 = svc.generate_eco_transcript(t_req)

        _fake_redis._store.pop(
            f"transcript:{partner.partner_id}:0xalwayssameWallet".lower(), None
        )
        t2 = svc.generate_eco_transcript(t_req)
        assert t1.total_verified_actions == t2.total_verified_actions


# ─── Carbon Credit Packages ───────────────────────────────────────────────────

class TestCarbonCreditPackages:
    def test_create_and_list_package(self, fresh_service):
        svc = fresh_service
        pkg = svc.create_carbon_package(
            region           = "Portland, OR",
            period           = "Q2-2026",
            verified_actions = 12_345,
            co2_offset_kg    = 34_567.0,
            blockchain_proofs= ["0xabc", "0xdef"],
            price_usd        = 2_500.0,
            eco_tokens       = 5_000,
        )

        assert pkg.package_id.startswith("ECP-")
        assert pkg.region          == "Portland, OR"
        assert pkg.eco_tokens_included == 5_000

        listed = svc.list_carbon_packages()
        assert len(listed) == 1
        assert listed[0].package_id == pkg.package_id

    def test_package_id_includes_region_prefix(self, fresh_service):
        svc = fresh_service
        pkg = svc.create_carbon_package(
            region="Austin, TX", period="Q3-2026",
            verified_actions=500, co2_offset_kg=1000.0,
            blockchain_proofs=[], price_usd=500.0, eco_tokens=1000,
        )
        assert "AUS" in pkg.package_id


# ─── Revenue Summary ─────────────────────────────────────────────────────────

class TestRevenueSummary:
    def test_revenue_summary_structure(self, fresh_service):
        svc     = fresh_service
        summary = svc.get_revenue_summary("Y1-2026")

        assert summary.period          == "Y1-2026"
        assert summary.total_revenue   > 0
        assert summary.eco_buy_pressure_usd > 0
        # All individual streams should sum to total
        total_calc = (
            summary.brand_challenge_revenue
            + summary.esg_subscription_revenue
            + summary.school_revenue
            + summary.carbon_credit_revenue
            + summary.vaas_revenue
        )
        assert abs(total_calc - summary.total_revenue) < 0.01
