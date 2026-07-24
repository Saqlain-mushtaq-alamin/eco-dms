"""
Multi-Modal Verifier (Phase 4 — Plan 06)
==========================================
Cross-references text, image, location, history, and fraud signals to
produce a holistic authenticity verdict beyond pure ML classification.

This implements the architecture described in Plan 06 §Phase 4:
  "Cross-reference text, image, AND location for higher confidence."

Key outputs:
  - cross-modal consistency score (image vs. text vs. location)
  - overall multi-modal confidence
  - detailed authenticity breakdown matching the enhanced verdict spec

Usage in worker.py:
    from backend.ml.fraud.multimodal_verifier import multimodal_verifier
    mm_result = multimodal_verifier.verify(
        ml_verdict=verdict,
        text_content=text_content,
        fraud_result=fraud_result,
        category=verdict.get("category"),
    )
    # mm_result.to_dict()  → inject into final signed verdict
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Category-to-visual-label mapping  (used for cross-modal consistency check)
# ---------------------------------------------------------------------------
_CATEGORY_VISUAL_CUES: dict[str, list[str]] = {
    "tree_planting":           ["tree", "plant", "garden", "shovel", "soil", "person"],
    "solar_installation":      ["solar panel", "roof", "panel", "sunlight"],
    "bicycle_commute":         ["bicycle", "bike", "cyclist", "helmet", "road"],
    "cycling_commute":         ["bicycle", "bike", "cyclist"],
    "public_transport":        ["bus", "train", "metro", "subway", "tram"],
    "recycling":               ["recycle bin", "bin", "plastic", "bottle", "bag"],
    "recycling_electronics":   ["computer", "phone", "electronic", "battery"],
    "beach_cleanup":           ["beach", "ocean", "sand", "bag", "person", "wave"],
    "community_cleanup":       ["bag", "person", "street", "park", "litter"],
    "composting":              ["compost", "soil", "bin", "garden", "worm"],
    "electric_vehicle":        ["car", "electric car", "charging station", "ev"],
    "home_insulation":         ["wall", "foam", "insulation", "worker"],
    "led_lighting":            ["light", "bulb", "led", "lamp"],
    "rainwater_collection":    ["barrel", "tank", "rain", "pipe", "roof"],
    "vegetarian_meal":         ["salad", "vegetables", "food", "meal", "plate"],
    "vegan_meal":              ["salad", "vegetables", "food", "meal", "fruit"],
    "general_eco_action":      ["green", "nature", "outdoor", "plant", "environment"],
}

# Category-to-reasonable-location-context mapping
_CATEGORY_LOCATION_CONTEXT: dict[str, list[str]] = {
    "tree_planting":           ["park", "forest", "garden", "outdoor", "countryside"],
    "beach_cleanup":           ["beach", "coast", "ocean", "sea", "shore"],
    "solar_installation":      ["roof", "home", "building", "outdoor"],
    "bicycle_commute":         ["road", "street", "path", "outdoor"],
    "recycling":               ["recycling center", "depot", "bin", "outdoor"],
    "community_cleanup":       ["street", "park", "neighborhood", "outdoor"],
}


@dataclass
class ConsistencyResult:
    image_text_match: float        # 0.0–1.0
    location_context_match: float  # 0.0–1.0
    overall: float                 # 0.0–1.0
    signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "image_text_match":       round(self.image_text_match, 3),
            "location_context_match": round(self.location_context_match, 3),
            "overall":                round(self.overall, 3),
            "signals":                self.signals,
        }


@dataclass
class AuthenticityResult:
    is_original: bool
    ai_generated_prob: float
    has_exif: bool
    has_gps: bool
    duplicate_found: bool
    editing_detected: bool
    fraud_score: int
    flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "is_original":        self.is_original,
            "ai_generated_prob":  round(self.ai_generated_prob, 4),
            "has_exif":           self.has_exif,
            "has_gps":            self.has_gps,
            "duplicate_found":    self.duplicate_found,
            "editing_detected":   self.editing_detected,
            "fraud_score":        self.fraud_score,
            "flags":              self.flags,
        }


@dataclass
class MultiModalResult:
    multimodal_confidence: float      # Adjusted confidence incorporating all signals
    is_authentic: bool
    consistency: ConsistencyResult
    authenticity: AuthenticityResult
    signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "multimodal_confidence": round(self.multimodal_confidence, 3),
            "is_authentic":          self.is_authentic,
            "consistency":           self.consistency.to_dict(),
            "authenticity":          self.authenticity.to_dict(),
            "signals":               self.signals,
        }


class MultiModalVerifier:
    """
    Cross-references ML image results, text content, location, and fraud
    signals to produce an enhanced authenticity & consistency verdict.

    Implements Plan 06 §Phase 4 "Multi-Modal Verification".
    """

    # ── Image–Text consistency ───────────────────────────────────────────────

    def _check_image_text_consistency(
        self,
        detected_objects: list[str],
        text_content: str,
        category: str,
    ) -> tuple[float, list[str]]:
        """
        Score how well the detected visual objects match the text claim
        and the declared eco-action category.

        Returns (score 0.0–1.0, signals list).
        """
        signals: list[str] = []

        if not detected_objects and not text_content:
            return 0.5, ["No objects or text — cannot assess consistency"]

        # Expected visual cues for this category
        expected_cues = _CATEGORY_VISUAL_CUES.get(category, _CATEGORY_VISUAL_CUES["general_eco_action"])

        # Check how many expected visual cues appear in detected objects
        detected_lower = [o.lower() for o in (detected_objects or [])]
        matched_cues = [
            cue for cue in expected_cues
            if any(cue in det or det in cue for det in detected_lower)
        ]

        visual_match_ratio = len(matched_cues) / max(len(expected_cues), 1)

        if matched_cues:
            signals.append(f"Visual cues matched: {', '.join(matched_cues)}")
        elif detected_objects:
            signals.append(f"Detected objects ({', '.join(detected_objects[:3])}) don't strongly match category '{category}'")

        # Text relevance: does the text mention eco-keywords related to category?
        text_score = 0.5  # neutral default when no text
        if text_content:
            text_lower = text_content.lower()
            category_words = set(category.split("_"))
            text_words = set(re.findall(r"\w+", text_lower))
            overlap = category_words & text_words
            if overlap:
                text_score = min(0.5 + 0.2 * len(overlap), 1.0)
                signals.append(f"Text matches category keywords: {', '.join(overlap)}")
            else:
                text_score = 0.3
                signals.append("Text does not clearly mention the declared eco-action")

        # Combined: 60% visual + 40% text
        score = 0.6 * visual_match_ratio + 0.4 * text_score
        return round(min(max(score, 0.0), 1.0), 3), signals

    # ── Location context check ───────────────────────────────────────────────

    def _check_location_context(
        self,
        text_content: str,
        category: str,
        has_gps: bool,
    ) -> tuple[float, list[str]]:
        """
        Check if the mentioned location/context makes sense for the eco-action.

        Returns (score 0.0–1.0, signals list).
        """
        signals: list[str] = []

        # GPS presence is a strong authenticity signal
        base = 0.5
        if has_gps:
            base = 0.75
            signals.append("GPS metadata present — verifiable location")
        else:
            signals.append("No GPS metadata — location unverified")

        if not text_content:
            return base, signals

        text_lower = text_content.lower()
        expected_locations = _CATEGORY_LOCATION_CONTEXT.get(category, [])

        if not expected_locations:
            return base, signals

        matched_locations = [loc for loc in expected_locations if loc in text_lower]
        if matched_locations:
            signals.append(f"Location context matches action: {', '.join(matched_locations)}")
            return min(base + 0.2, 1.0), signals

        return base, signals

    # ── Authenticity from fraud result ───────────────────────────────────────

    def _build_authenticity(self, fraud_result) -> AuthenticityResult:
        """
        Convert FraudResult into a structured AuthenticityResult for the enhanced verdict.
        """
        details = getattr(fraud_result, "details", {}) or {}

        # AI detection
        ai_det = details.get("ai_detection", {})
        ai_prob = float(ai_det.get("confidence", 0.0))

        # EXIF data
        exif = details.get("exif", {})
        has_exif = bool(exif.get("has_timestamp") or exif.get("has_gps") or exif.get("camera_model"))
        has_gps = bool(exif.get("has_gps", False))
        editing_detected = False
        if "editing_software" in exif and exif["editing_software"]:
            editing_detected = True

        # Duplicate
        dup = details.get("duplicate", {})
        duplicate_found = bool(dup.get("is_duplicate", False))

        is_original = (
            not duplicate_found
            and not (ai_prob > 0.7)
            and not editing_detected
        )

        flags: list[str] = list(getattr(fraud_result, "reasons", []) or [])

        return AuthenticityResult(
            is_original=is_original,
            ai_generated_prob=ai_prob,
            has_exif=has_exif,
            has_gps=has_gps,
            duplicate_found=duplicate_found,
            editing_detected=editing_detected,
            fraud_score=int(getattr(fraud_result, "fraud_score", 0)),
            flags=flags,
        )

    # ── Confidence aggregation ───────────────────────────────────────────────

    def _aggregate_confidence(
        self,
        ml_confidence: float,
        consistency: ConsistencyResult,
        authenticity: AuthenticityResult,
    ) -> float:
        """
        Blend ML confidence with multi-modal signals.

        Penalties:
          - AI-generated prob > 0.5 → −0.20
          - Duplicate found        → −0.30
          - Low consistency (<0.5) → −0.15
          - Heavy fraud score      → −0.10 per 20 pts

        Bonuses:
          - GPS present            → +0.05
          - High consistency       → +0.05
          - Authentic + consistent → +0.03
        """
        conf = float(ml_confidence)

        # Authenticity penalties
        if authenticity.duplicate_found:
            conf -= 0.30
        if authenticity.ai_generated_prob > 0.5:
            conf -= 0.20
        if authenticity.editing_detected:
            conf -= 0.05
        fraud_penalty = (authenticity.fraud_score // 20) * 0.10
        conf -= fraud_penalty

        # Consistency signal
        if consistency.overall < 0.5:
            conf -= 0.15
        elif consistency.overall >= 0.8:
            conf += 0.05

        # Authenticity bonuses
        if authenticity.has_gps:
            conf += 0.05
        if authenticity.is_original and consistency.overall >= 0.7:
            conf += 0.03

        return round(min(max(conf, 0.0), 1.0), 3)

    # ── Public API ───────────────────────────────────────────────────────────

    def verify(
        self,
        ml_verdict: dict,
        text_content: Optional[str] = None,
        fraud_result=None,
        category: Optional[str] = None,
    ) -> MultiModalResult:
        """
        Run multi-modal cross-reference verification.

        Args:
            ml_verdict:   Result dict from EcoVerifier.verify_image()
            text_content: Post description text
            fraud_result: FraudResult from fraud_pipeline.run()
            category:     Eco action category slug

        Returns:
            MultiModalResult with consistency, authenticity, and adjusted confidence
        """
        ml_confidence = float(ml_verdict.get("confidence", 0.5))
        detected_objects: list[str] = ml_verdict.get("detected_objects", []) or []
        category = category or ml_verdict.get("category") or "general_eco_action"
        text_content = text_content or ""

        # 1. Image–text consistency
        img_text_score, img_text_signals = self._check_image_text_consistency(
            detected_objects, text_content, category
        )

        # 2. Location context
        has_gps = False
        if fraud_result:
            details = getattr(fraud_result, "details", {}) or {}
            exif = details.get("exif", {})
            has_gps = bool(exif.get("has_gps", False))

        loc_score, loc_signals = self._check_location_context(text_content, category, has_gps)

        # 3. Combined consistency
        overall_consistency = round(0.65 * img_text_score + 0.35 * loc_score, 3)
        all_signals = img_text_signals + loc_signals

        consistency = ConsistencyResult(
            image_text_match=img_text_score,
            location_context_match=loc_score,
            overall=overall_consistency,
            signals=all_signals,
        )

        # 4. Authenticity breakdown
        if fraud_result:
            authenticity = self._build_authenticity(fraud_result)
        else:
            authenticity = AuthenticityResult(
                is_original=True,
                ai_generated_prob=0.0,
                has_exif=False,
                has_gps=False,
                duplicate_found=False,
                editing_detected=False,
                fraud_score=0,
                flags=[],
            )

        # 5. Aggregate multi-modal confidence
        final_confidence = self._aggregate_confidence(ml_confidence, consistency, authenticity)
        is_authentic = authenticity.is_original and not fraud_result or (
            getattr(fraud_result, "fraud_score", 0) < 30
        )

        logger.info(
            "MultiModal: ml_conf=%.3f → mm_conf=%.3f consistency=%.3f authentic=%s",
            ml_confidence, final_confidence, overall_consistency, is_authentic,
        )

        return MultiModalResult(
            multimodal_confidence=final_confidence,
            is_authentic=bool(is_authentic),
            consistency=consistency,
            authenticity=authenticity,
            signals=all_signals,
        )


# Singleton
multimodal_verifier = MultiModalVerifier()
