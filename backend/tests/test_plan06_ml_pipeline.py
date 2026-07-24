"""
Tests for Plan 06 ML Pipeline Evolution modules.

Covers:
  - CO2ImpactScorer (Phase 2)
  - MultiModalVerifier (Phase 4)
  - Enhanced verdict structure in worker pipeline
"""
import pytest
from unittest.mock import MagicMock


# ── CO2 Impact Scorer ────────────────────────────────────────────────────────

class TestCO2ImpactScorer:
    """Phase 2: CO₂ estimation tests."""

    @pytest.fixture(autouse=True)
    def scorer(self):
        from backend.ml.fraud.co2_impact_scorer import CO2ImpactScorer
        self.scorer = CO2ImpactScorer()

    def test_tree_planting_from_text(self):
        result = self.scorer.score_impact(
            ml_detections=["tree", "shovel", "soil"],
            text_content="Today I planted 5 trees in the park",
            category="general_eco_action",
        )
        assert result.action_type == "tree_planting"
        assert result.scale == 5.0
        assert result.co2_offset_kg == pytest.approx(75.0, rel=0.01)  # 15 * 5
        assert result.tier == "high"

    def test_solar_installation_from_category(self):
        result = self.scorer.score_impact(
            ml_detections=[],
            text_content="",
            category="solar_installation",
        )
        assert result.action_type == "solar_installation"
        assert result.scale == 1.0
        assert result.co2_offset_kg == pytest.approx(50.0, rel=0.01)
        assert result.tier in ("high", "exceptional")

    def test_bicycle_commute_from_detections(self):
        result = self.scorer.score_impact(
            ml_detections=["bicycle", "helmet"],
            text_content="Commuting today",
            category="general_eco_action",
        )
        # "bicycle" is a YOLO label alias for bicycle_commute in the IMPACT_TABLE
        assert result.action_type in ("bicycle_commute", "cycling_commute", "bicycle")
        assert result.co2_offset_kg > 0
        assert result.co2_offset_kg == pytest.approx(3.1, rel=0.01)

    def test_scale_extraction_word_number(self):
        result = self.scorer.score_impact(
            ml_detections=[],
            text_content="I planted three trees near the river",
            category="tree_planting",
        )
        assert result.scale == 3.0
        assert result.co2_offset_kg == pytest.approx(45.0, rel=0.01)

    def test_low_impact_general_action(self):
        result = self.scorer.score_impact(
            ml_detections=[],
            text_content="Used a reusable bag today",
            category="general_eco_action",
        )
        assert result.action_type in ("general_eco_action", "zero_waste_shopping")
        assert result.co2_offset_kg > 0
        assert result.tier == "low"

    def test_to_dict_returns_correct_keys(self):
        result = self.scorer.score_impact(
            ml_detections=[],
            text_content="tree planting",
            category="tree_planting",
        )
        d = result.to_dict()
        assert "action_type" in d
        assert "co2_offset_kg" in d
        assert "scale" in d
        assert "tier" in d
        assert "methodology" in d

    def test_exceptional_tier_habitat_restoration(self):
        result = self.scorer.score_impact(
            ml_detections=[],
            text_content="Restored 10 hectares of wetland habitat",
            category="habitat_restoration",
        )
        # 20 kg * 10 = 200 kg → exceptional
        assert result.tier == "exceptional"
        assert result.co2_offset_kg >= 100.0


# ── Multi-Modal Verifier ─────────────────────────────────────────────────────

class TestMultiModalVerifier:
    """Phase 4: Cross-modal consistency tests."""

    @pytest.fixture(autouse=True)
    def verifier(self):
        from backend.ml.fraud.multimodal_verifier import MultiModalVerifier
        self.verifier = MultiModalVerifier()

    def _make_verdict(self, confidence=0.85, objects=None, category="tree_planting"):
        return {
            "is_eco": True,
            "confidence": confidence,
            "detected_objects": objects or ["tree", "shovel"],
            "category": category,
            "breakdown": {"clip_score": 0.7, "efficientnet_score": 0.8, "text_score": 0.5},
        }

    def test_high_consistency_returns_valid_result(self):
        verdict = self._make_verdict()
        result = self.verifier.verify(
            ml_verdict=verdict,
            text_content="Planted 5 trees in the park with my team",
            fraud_result=None,
            category="tree_planting",
        )
        assert result.multimodal_confidence > 0.0
        assert result.consistency.overall >= 0.0
        assert result.consistency.image_text_match >= 0.0
        assert result.consistency.location_context_match >= 0.0
        assert isinstance(result.to_dict(), dict)

    def test_duplicate_fraud_reduces_confidence(self):
        verdict = self._make_verdict()

        # Simulate a fraud result with a duplicate
        fraud_mock = MagicMock()
        fraud_mock.fraud_score = 60
        fraud_mock.reasons = ["Duplicate image"]
        fraud_mock.details = {
            "duplicate": {"is_duplicate": True, "hamming_distance": 0},
            "ai_detection": {"confidence": 0.1},
            "exif": {"has_gps": False, "has_timestamp": True, "camera_model": "iPhone"},
        }

        result = self.verifier.verify(
            ml_verdict=verdict,
            text_content="Planted trees",
            fraud_result=fraud_mock,
            category="tree_planting",
        )
        # Confidence should drop significantly due to duplicate
        assert result.multimodal_confidence < 0.85
        assert result.authenticity.duplicate_found is True

    def test_gps_presence_boosts_confidence(self):
        verdict = self._make_verdict(confidence=0.75)

        no_gps_fraud = MagicMock()
        no_gps_fraud.fraud_score = 0
        no_gps_fraud.reasons = []
        no_gps_fraud.details = {
            "duplicate": {"is_duplicate": False},
            "ai_detection": {"confidence": 0.0},
            "exif": {"has_gps": False, "has_timestamp": True, "camera_model": "Canon"},
        }

        gps_fraud = MagicMock()
        gps_fraud.fraud_score = 0
        gps_fraud.reasons = []
        gps_fraud.details = {
            "duplicate": {"is_duplicate": False},
            "ai_detection": {"confidence": 0.0},
            "exif": {"has_gps": True, "has_timestamp": True, "camera_model": "Canon"},
        }

        result_no_gps = self.verifier.verify(verdict, "planted trees", no_gps_fraud, "tree_planting")
        result_gps    = self.verifier.verify(verdict, "planted trees", gps_fraud, "tree_planting")

        assert result_gps.multimodal_confidence >= result_no_gps.multimodal_confidence

    def test_consistency_to_dict_structure(self):
        result = self.verifier.verify(
            ml_verdict=self._make_verdict(),
            text_content="Bicycle commute to office",
            fraud_result=None,
            category="bicycle_commute",
        )
        d = result.consistency.to_dict()
        assert "image_text_match" in d
        assert "location_context_match" in d
        assert "overall" in d
        assert "signals" in d
        assert isinstance(d["signals"], list)

    def test_authenticity_result_is_original_when_no_fraud(self):
        verdict = self._make_verdict()
        result = self.verifier.verify(verdict, "green action", None, "general_eco_action")
        assert result.authenticity.is_original is True
        assert result.authenticity.fraud_score == 0
        assert result.authenticity.duplicate_found is False

    def test_confidence_clamped_to_valid_range(self):
        # Even with many penalties, output should stay >= 0.0 and <= 1.0
        verdict = self._make_verdict(confidence=0.1)
        fraud_mock = MagicMock()
        fraud_mock.fraud_score = 100
        fraud_mock.reasons = ["many flags"]
        fraud_mock.details = {
            "duplicate": {"is_duplicate": True, "hamming_distance": 0},
            "ai_detection": {"confidence": 0.95},
            "exif": {"has_gps": False, "has_timestamp": False, "editing_software": "Photoshop"},
        }
        result = self.verifier.verify(verdict, "", fraud_mock, "general_eco_action")
        assert 0.0 <= result.multimodal_confidence <= 1.0


# ── Enhanced Verdict Structure ───────────────────────────────────────────────

class TestEnhancedVerdictStructure:
    """Verify that enhanced verdict dict matches Plan 06 spec."""

    def test_co2_impact_dict_matches_plan06_spec(self):
        from backend.ml.fraud.co2_impact_scorer import CO2ImpactScorer
        scorer = CO2ImpactScorer()
        result = scorer.score_impact(["tree"], "planted 3 trees", "tree_planting")
        d = result.to_dict()

        # Plan 06 enhanced_verdict["impact"] must have these keys
        assert d["action_type"] == "tree_planting"
        assert d["category"] == "tree_planting"
        assert isinstance(d["scale"], float)
        assert isinstance(d["co2_offset_kg"], float)
        assert d["methodology"].startswith("EcoDMS Impact Model")

    def test_authenticity_dict_matches_plan06_spec(self):
        from backend.ml.fraud.multimodal_verifier import MultiModalVerifier
        verifier = MultiModalVerifier()
        result = verifier.verify(
            {"confidence": 0.9, "detected_objects": [], "breakdown": {}},
            text_content="",
            fraud_result=None,
            category="general_eco_action",
        )
        auth = result.authenticity.to_dict()

        # Plan 06 enhanced_verdict["authenticity"] must have these keys
        for key in ["is_original", "ai_generated_prob", "has_exif", "has_gps",
                    "duplicate_found", "editing_detected"]:
            assert key in auth, f"Missing authenticity key: {key}"

    def test_consistency_dict_matches_plan06_spec(self):
        from backend.ml.fraud.multimodal_verifier import MultiModalVerifier
        verifier = MultiModalVerifier()
        result = verifier.verify(
            {"confidence": 0.88, "detected_objects": ["bicycle"], "breakdown": {}},
            text_content="biking to work",
            fraud_result=None,
            category="bicycle_commute",
        )
        cons = result.consistency.to_dict()

        # Plan 06 enhanced_verdict["consistency"] must have these keys
        for key in ["image_text_match", "location_context_match", "overall"]:
            assert key in cons, f"Missing consistency key: {key}"
            assert 0.0 <= cons[key] <= 1.0
