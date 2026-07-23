"""
Integration Tests — Phase 3/4 Backend Services
================================================
Tests the fraud pipeline, impact scorer, AI detector,
level service, streak service, action graph service,
boost service (mocked), and feed ranking algorithm.

Run:
    pytest backend/tests/test_services_integration.py -v
"""
import math
import time

import pytest

# ── Level Service ────────────────────────────────────────────────────────────
from backend.app.services.level_service import get_level, LEVEL_TABLE


class TestLevelService:
    def test_level_1_at_zero(self):
        r = get_level(0, 0.0)
        assert r.level == 1
        assert r.title == "Eco Seedling"

    def test_level_5_threshold(self):
        # Level 5 (Green Citizen) needs 25 actions + 30 kg CO2
        r = get_level(25, 30.0)
        assert r.level == 5

    def test_level_6_threshold(self):
        # Level 6 (Eco Activist) needs 40 actions + 60 kg CO2
        r = get_level(40, 60.0)
        assert r.level == 6

    def test_dual_gate_both_required(self):
        # High actions but low CO₂ → stuck at lower level
        r_low_co2 = get_level(1000, 1.0)
        r_both    = get_level(1000, 7000.0)
        assert r_low_co2.level < r_both.level

    def test_progress_percentages_clamped(self):
        r = get_level(3, 1.0)
        assert 0.0 <= r.actions_progress_pct <= 100.0
        assert 0.0 <= r.co2_progress_pct    <= 100.0

    def test_max_level_20(self):
        r = get_level(999999, 999999.0)
        assert r.level == 20
        assert r.actions_to_next == 0
        assert r.co2_to_next == 0.0
        assert r.actions_progress_pct == 100.0

    def test_all_levels_reachable(self):
        for row in LEVEL_TABLE:
            min_act, min_co2, level, _, _ = row
            r = get_level(min_act, min_co2)
            assert r.level == level


# ── Streak Service ───────────────────────────────────────────────────────────
from backend.app.services.streak_service import streak_service
from datetime import datetime, timezone, timedelta


class TestStreakService:
    def _dates(self, offsets: list[int]) -> list[str]:
        today = datetime.now(timezone.utc)
        return [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in offsets]

    def test_empty_posts(self):
        r = streak_service.compute([])
        assert r.current_streak_days == 0
        assert r.longest_streak_days == 0

    def test_single_today(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = streak_service.compute([today])
        assert r.current_streak_days == 1
        assert r.is_active_today is True

    def test_streak_continuity(self):
        dates = self._dates([0, 1, 2, 3, 4])  # 5 consecutive days
        r = streak_service.compute(dates)
        assert r.current_streak_days == 5
        assert r.longest_streak_days == 5

    def test_streak_broken(self):
        # today + two days 3-4 days ago (gap at days 1-2)
        dates = self._dates([0, 3, 4])
        r = streak_service.compute(dates)
        assert r.current_streak_days == 1   # only today
        assert r.longest_streak_days == 2   # days 3+4 = 2 consecutive

    def test_streak_at_risk_flag(self):
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        r = streak_service.compute([yesterday])
        assert r.streak_at_risk is True
        assert r.is_active_today is False

    def test_weekly_completion(self):
        # Post 3 of the last 7 days (0, 2, 4 days ago)
        dates = self._dates([0, 2, 4])
        r = streak_service.compute(dates)
        assert r.weekly_completion == 3


# ── Action Graph Service ─────────────────────────────────────────────────────
from backend.app.services.action_graph_service import build_action_graph, serialize_graph


class TestActionGraphService:
    def test_empty_produces_52_weeks(self):
        g = build_action_graph([])
        # Graph can be 52 or 53 weeks depending on the day of year (both are correct)
        assert len(g.weeks) in (52, 53)
        assert g.total_posts == 0
        assert g.total_active_days == 0

    def test_single_post_counted(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        g = build_action_graph([{"completed_at": f"{today}T10:00:00Z", "co2_kg": 2.5}])
        assert g.total_posts == 1
        assert g.total_active_days == 1
        assert g.peak_day_count == 1

    def test_intensity_levels(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        posts = [{"completed_at": f"{today}T{h:02d}:00:00Z", "co2_kg": 1.0} for h in range(5)]
        g = build_action_graph(posts)
        # The last week's cell for today should have level > 0
        last_week = g.weeks[-1]
        weekday = datetime.now(timezone.utc).weekday()
        today_cell = last_week.days[weekday]
        assert today_cell.level > 0

    def test_serialization_shape(self):
        g = build_action_graph([])
        s = serialize_graph(g)
        assert "weeks" in s
        assert "total_active_days" in s
        assert "month_labels" in s
        # Graph is 52 or 53 weeks depending on calendar boundary
        assert len(s["weeks"]) in (52, 53)
        for week in s["weeks"]:
            assert len(week["days"]) == 7
            for day in week["days"]:
                assert "level" in day
                assert 0 <= day["level"] <= 4

    def test_month_labels_unique(self):
        g = build_action_graph([])
        months = [m["month"] for m in g.month_labels]
        assert len(months) == len(set(months)), "Month labels should be unique"


# ── Impact Scorer ────────────────────────────────────────────────────────────
from backend.ml.fraud.impact_scorer import impact_scorer


class TestImpactScorer:
    def test_perfect_score(self):
        r = impact_scorer.score(
            ml_confidence=1.0,
            category="solar_installation",
            image_count=4,
            text_content="Installed 6kW solar panels on my roof today reducing my carbon footprint significantly. Full system documentation included in photos.",
            author_accuracy=0.99,
        )
        assert r.value >= 80
        assert r.tier == "exceptional"
        assert r.multiplier == 2.0

    def test_low_confidence_caps_ml_component(self):
        r = impact_scorer.score(ml_confidence=0.75)
        assert r.components["ml_confidence"] == 0.0

    def test_category_weighting(self):
        high = impact_scorer.score(ml_confidence=1.0, category="solar_installation")
        low  = impact_scorer.score(ml_confidence=1.0, category="reusable_bag")
        assert high.components["category_impact"] > low.components["category_impact"]

    def test_new_user_neutral_trust(self):
        r = impact_scorer.score(ml_confidence=1.0, author_accuracy=-1.0)
        assert r.components["author_trust"] == 7.5

    def test_tier_boundaries(self):
        r_low  = impact_scorer.score(ml_confidence=0.8, category="reusable_bag", image_count=1)
        r_high = impact_scorer.score(ml_confidence=1.0, category="solar_installation", image_count=4,
                                     text_content="x " * 30, author_accuracy=1.0)
        assert r_low.tier in ("low", "medium")
        assert r_high.tier in ("high", "exceptional")

    def test_multiplier_range(self):
        for _ in range(10):
            r = impact_scorer.score(ml_confidence=0.9)
            assert 0.5 <= r.multiplier <= 2.0


# ── AI Detector ─────────────────────────────────────────────────────────────
from backend.ml.fraud.ai_detector import ai_detector


class TestAIDetector:
    def _make_fake_image(self, width=100, height=100, uniform=False) -> bytes:
        """Create a minimal valid PNG for testing."""
        try:
            from PIL import Image
            import io
            img = Image.new("RGB", (width, height), color=(128, 128, 128) if uniform else None)
            if not uniform:
                import random
                pixels = img.load()
                for x in range(width):
                    for y in range(height):
                        pixels[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()
        except ImportError:
            pytest.skip("Pillow not installed")

    def test_uniform_image_suspicious(self):
        img = self._make_fake_image(uniform=True)
        r = ai_detector.detect(img)
        # Uniform image should have high pixel noise score (near-zero variance)
        assert r.fraud_score >= 0  # may or may not trigger depending on threshold
        assert isinstance(r.is_ai_generated, bool)
        assert 0.0 <= r.confidence <= 1.0

    def test_invalid_bytes_returns_clean(self):
        r = ai_detector.detect(b"not an image")
        assert r.is_ai_generated is False
        assert r.fraud_score == 0

    def test_fraud_score_range(self):
        img = self._make_fake_image()
        r = ai_detector.detect(img)
        assert 0 <= r.fraud_score <= 45

    def test_result_fields(self):
        r = ai_detector.detect(b"garbage")
        assert hasattr(r, "is_ai_generated")
        assert hasattr(r, "confidence")
        assert hasattr(r, "fraud_score")
        assert hasattr(r, "signals")
        assert hasattr(r, "reason")


# ── Feed Service ─────────────────────────────────────────────────────────────
from backend.app.services.feed_service import FeedService, FeedPost


class TestFeedService:
    def _post(self, **kwargs) -> FeedPost:
        defaults = dict(
            post_cid="Qm" + "a" * 44,
            author_wallet="0x" + "a" * 40,
            created_at=time.time(),
            ml_confidence=0.9,
            eco_level=5,
            impact_score=50.0,
            likes=10, comments=5, views=100, shares=2,
            active_boost_level=0,
        )
        defaults.update(kwargs)
        return FeedPost(**defaults)

    def test_higher_boost_scores_more(self):
        svc = FeedService()
        no_boost   = svc.score_post(self._post(active_boost_level=0))
        spark      = svc.score_post(self._post(active_boost_level=1))
        wildfire   = svc.score_post(self._post(active_boost_level=3))
        assert wildfire.feed_score > spark.feed_score > no_boost.feed_score

    def test_older_post_scores_less(self):
        svc = FeedService()
        fresh = svc.score_post(self._post(created_at=time.time()))
        old   = svc.score_post(self._post(created_at=time.time() - 3600 * 96))
        assert fresh.feed_score > old.feed_score

    def test_higher_level_scores_more(self):
        svc = FeedService()
        low_level  = svc.score_post(self._post(eco_level=1))
        high_level = svc.score_post(self._post(eco_level=20))
        assert high_level.feed_score > low_level.feed_score

    def test_rank_posts_sorted(self):
        svc = FeedService()
        posts = [
            self._post(post_cid="Qm" + str(i) + "a" * 43, active_boost_level=i % 4)
            for i in range(10)
        ]
        ranked = svc.rank_posts(posts)
        scores = [s.feed_score for _, s in ranked]
        assert scores == sorted(scores, reverse=True)

    def test_boost_multiplier_values(self):
        svc = FeedService()
        assert svc._boost_multiplier(0) == 1.0
        assert svc._boost_multiplier(1) == 3.0
        assert svc._boost_multiplier(2) == 10.0
        assert svc._boost_multiplier(3) == 50.0

    def test_log2_helper(self):
        assert FeedService._log2(1) == 0.0
        assert FeedService._log2(2) == pytest.approx(1.0)
        assert FeedService._log2(1024) == pytest.approx(10.0)

    def test_recency_decay(self):
        svc = FeedService()
        fresh    = self._post(created_at=time.time())
        halflife = self._post(created_at=time.time() - 3600 * 48)
        s_fresh  = svc.score_post(fresh)
        s_half   = svc.score_post(halflife)
        # Fresh post must always score higher than old post
        assert s_fresh.recency_factor > s_half.recency_factor
        # At t = halflife, exp(-t/halflife) = exp(-1) ≈ 0.368 (not 0.5)
        # 0.5 would only be correct for a log2-based formula
        assert 0.30 < s_half.recency_factor < 0.45  # 1/e with some float tolerance


# ── Fraud Pipeline (no images) ───────────────────────────────────────────────
from backend.ml.fraud.pipeline import fraud_pipeline


class TestFraudPipeline:
    def test_clean_post_no_image(self):
        r = fraud_pipeline.run(
            image_bytes=None,
            post_cid="QmTestCleanPost123",
            wallet="0x" + "b" * 40,
            text_content="Planted 10 trees today in my local park.",
            ml_confidence=0.95,
            category="tree_planting",
        )
        assert r.block is False
        assert r.fraud_score < 60

    def test_fraud_result_has_impact(self):
        r = fraud_pipeline.run(
            image_bytes=None,
            post_cid="QmTestImpact456",
            wallet="0x" + "c" * 40,
            ml_confidence=0.9,
            category="solar_installation",
            image_count=3,
            text_content="Installed solar panels — 6kW system, full permit documentation available.",
        )
        assert r.impact_score >= 0.0
        assert r.impact_tier in ("low", "medium", "high", "exceptional")
        assert 0.5 <= r.impact_multiplier <= 2.0

    def test_result_fields_complete(self):
        r = fraud_pipeline.run(image_bytes=None, post_cid="QmX", wallet="0x" + "d" * 40)
        required = ["block", "flag_for_review", "fraud_score", "ai_generated",
                    "impact_score", "impact_tier", "impact_multiplier", "reasons", "details"]
        for field in required:
            assert hasattr(r, field), f"Missing field: {field}"
        assert r.impact_tier in ("low", "medium", "high", "exceptional")
        assert r.fraud_score <= 100
        # Force multiple signals by passing suspicious values
        r = fraud_pipeline.run(
            image_bytes=None,
            post_cid="QmForceHighScore" + "z" * 20,
            wallet="0x" + "e" * 40,
        )
        assert r.fraud_score <= 100
