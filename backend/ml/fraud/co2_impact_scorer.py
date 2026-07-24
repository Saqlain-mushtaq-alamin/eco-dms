"""
CO₂ Impact Scorer (Phase 2 — Plan 06)
=======================================
Estimates the real-world environmental impact of a verified eco-action
as a CO₂-equivalent offset in kilograms.

This is distinct from the credibility ImpactScorer (impact_scorer.py):
  - credibility scorer  → how trustworthy is this submission? (0-100 pts)
  - CO₂ impact scorer   → what is the actual environmental impact? (kg CO₂e)

Impact table is derived from EPA/DEFRA emission factors and aligned with
Plan 06 §"Phase 2: Impact Scoring (CO₂ Estimation)".

Usage in worker.py after ML inference:
    from backend.ml.fraud.co2_impact_scorer import co2_impact_scorer
    impact = co2_impact_scorer.score_impact(
        ml_detections=verdict["detected_objects"],
        text_content=post_text,
        category=verdict.get("category", "general_eco_action"),
    )
    # impact.co2_offset_kg  → float  (kg CO₂e saved)
    # impact.action_type    → str    (e.g. "tree_planting")
    # impact.scale          → float  (e.g. 5.0 for "planted 5 trees")
    # impact.tier           → str    (low|medium|high|exceptional)
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Impact lookup table — kg CO₂-equivalent per unit action
# Source: EPA/DEFRA emission factor guidelines (EcoDMS Impact Model v1)
# ---------------------------------------------------------------------------
IMPACT_TABLE: dict[str, float] = {
    # Transport (per trip/day)
    "public_transport":          2.6,
    "bicycle_commute":           3.1,
    "cycling_commute":           3.1,
    "electric_vehicle":          1.8,
    "ev_purchase":               1.8,
    "carpool":                   1.5,
    "walking_commute":           3.5,

    # Nature (per instance)
    "tree_planting":            15.0,   # Annual CO₂ absorption
    "garden_creation":           5.0,
    "habitat_restoration":      20.0,
    "composting":                0.5,
    "food_waste_composting":     0.5,

    # Waste reduction
    "recycling_electronics":     5.0,
    "recycling":                 1.0,
    "recycling_general":         1.0,
    "beach_cleanup":             3.0,
    "community_cleanup":         3.0,
    "zero_waste_shopping":       0.8,
    "plastic_free_day":          0.8,
    "clothing_repair":           2.0,
    "second_hand_purchase":      2.0,

    # Energy
    "solar_installation":       50.0,   # Per panel annual
    "solar_panel":              50.0,
    "renewable_energy":         40.0,
    "energy_efficient_appliance":10.0,
    "home_insulation":          30.0,
    "led_lighting":              0.5,

    # Water
    "rainwater_collection":      2.0,
    "water_conservation":        0.3,

    # Food
    "vegetarian_meal":           1.5,
    "vegan_meal":                2.0,
    "local_food_purchase":       0.8,

    # Generic fallback
    "general_eco_action":        0.5,
}

# Eco-keyword → action_type mapping (for text-based classification)
_TEXT_ACTION_MAP: list[tuple[list[str], str]] = [
    (["solar panel", "solar installation", "pv panel", "photovoltaic"],   "solar_installation"),
    (["wind turbine", "wind farm"],                                        "renewable_energy"),
    (["planted tree", "plant tree", "tree planting", "trees planted"],     "tree_planting"),
    (["electric vehicle", "ev ", "electric car", "tesla", "ev purchase"],  "electric_vehicle"),
    (["bicycle", "bike", "cycling commute", "biking to work"],             "bicycle_commute"),
    (["public transport", "bus", "metro", "subway", "train commute"],      "public_transport"),
    (["beach cleanup", "coastal cleanup"],                                  "beach_cleanup"),
    (["recycl", "e-waste", "electronics recycling"],                       "recycling_electronics"),
    (["compost", "composting"],                                             "composting"),
    (["rainwater", "rain water", "water harvesting"],                      "rainwater_collection"),
    (["led", "led light", "energy saving bulb"],                           "led_lighting"),
    (["insulation", "home insulation"],                                     "home_insulation"),
    (["vegan", "plant-based"],                                             "vegan_meal"),
    (["vegetarian"],                                                        "vegetarian_meal"),
    (["reusable bag", "cloth bag", "zero waste shopping"],                 "zero_waste_shopping"),
    (["second hand", "thrift", "repair cloth"],                            "clothing_repair"),
    (["garden", "urban garden"],                                           "garden_creation"),
    (["habitat", "rewilding", "restoration"],                              "habitat_restoration"),
    (["carpool", "ride sharing", "rideshare"],                             "carpool"),
    (["recycl"],                                                           "recycling"),
    (["water sav", "water conserv", "low flow"],                          "water_conservation"),
    (["local food", "farmers market", "locally grown"],                   "local_food_purchase"),
    (["community cleanup", "litter picking", "trash cleanup"],            "community_cleanup"),
]

# Numbers in English words (0–20) for scale extraction
_WORD_NUMBERS: dict[str, int] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20,
}

# CO₂ tiers for communicating impact magnitude
_CO2_TIERS: list[tuple[float, str]] = [
    (100.0, "exceptional"),
    (20.0,  "high"),
    (5.0,   "medium"),
    (0.0,   "low"),
]


@dataclass
class CO2ImpactResult:
    action_type: str
    category: str
    scale: float
    co2_offset_kg: float
    confidence: float
    tier: str
    methodology: str = "EcoDMS Impact Model v1 — EPA/DEFRA emission factors"
    components: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "action_type":    self.action_type,
            "category":       self.category,
            "scale":          self.scale,
            "co2_offset_kg":  round(self.co2_offset_kg, 2),
            "confidence":     round(self.confidence, 3),
            "tier":           self.tier,
            "methodology":    self.methodology,
        }


class CO2ImpactScorer:
    """
    Estimates real-world CO₂-equivalent impact of a verified eco-action.

    Implements Plan 06 Phase 2 — "Impact Scoring (CO₂ Estimation)".
    """

    # ── Internal helpers ────────────────────────────────────────────────────

    def _classify_action(
        self,
        ml_detections: list[str],
        text_content: str,
        category: str,
    ) -> str:
        """
        Determine primary action type from ML detections + text + category slug.

        Priority:
          1. Non-generic category slug  (most authoritative)
          2. Text keyword matching      (user description)
          3. YOLO detection labels      (fallback)
          4. generic_eco_action         (last resort)
        """
        GENERIC = {"general_eco_action", "", None}

        # 1. Non-generic category slug → direct IMPACT_TABLE lookup
        if category and category not in GENERIC and category in IMPACT_TABLE:
            return category

        # 2. Text-based keyword matching (runs before slug when slug is generic)
        if text_content:
            text_lower = text_content.lower()
            for keywords, action in _TEXT_ACTION_MAP:
                if any(kw in text_lower for kw in keywords):
                    return action

        # 3. Non-generic category that wasn't in IMPACT_TABLE yet (secondary)
        if category and category not in GENERIC:
            return category

        # 4. ML detected objects fallback
        for detected_obj in (ml_detections or []):
            obj_lower = detected_obj.lower().replace(" ", "_")
            if obj_lower in IMPACT_TABLE:
                return obj_lower
            # Also check with spaces (as stored in table)
            obj_spaced = detected_obj.lower()
            if obj_spaced in IMPACT_TABLE:
                return obj_spaced

        return "general_eco_action"

    def _estimate_scale(
        self,
        text_content: str,
        ml_detections: list[str],
    ) -> float:
        """
        Extract action scale from text (e.g. "planted 5 trees" → 5.0)
        or from detection count (3 trees detected → 3.0).

        Implements Plan 06 §_estimate_scale().
        """
        quantities: list[float] = []

        if text_content:
            # Match digit numbers near eco-keywords
            eco_pattern = (
                r"(\d+(?:\.\d+)?)\s*"
                r"(?:tree|plant|solar panel|panel|bag|bottle|"
                r"cycle|bike|session|trip|action|kg|ton|tonne|lb|hectare|acre)"
            )
            for match in re.finditer(eco_pattern, text_content, re.IGNORECASE):
                try:
                    quantities.append(float(match.group(1)))
                except ValueError:
                    pass

            # Match word-form numbers
            for word, val in _WORD_NUMBERS.items():
                pattern = rf"\b{word}\b\s+(?:tree|plant|panel|bag|bottle|trip|session|hectare|acre)"
                if re.search(pattern, text_content, re.IGNORECASE):
                    quantities.append(float(val))

        if quantities:
            return max(quantities)

        # Fallback: count detected eco-relevant objects
        eco_objects = [d for d in (ml_detections or []) if d.lower().replace(" ", "_") in IMPACT_TABLE]
        return max(float(len(eco_objects)), 1.0)

    def _impact_confidence(
        self,
        ml_detections: list[str],
        action_type: str,
    ) -> float:
        """Estimate confidence that the detected action matches the impact estimate."""
        if not ml_detections:
            return 0.4   # Text-only, medium confidence

        # Check if any detected object aligns with the derived action type
        action_words = set(action_type.lower().split("_"))
        for det in ml_detections:
            det_words = set(det.lower().split())
            if action_words & det_words:
                return 0.85

        return 0.55   # Action type inferred, but no direct visual confirmation

    @staticmethod
    def _co2_tier(co2_kg: float) -> str:
        for threshold, tier in _CO2_TIERS:
            if co2_kg >= threshold:
                return tier
        return "low"

    # ── Public API ──────────────────────────────────────────────────────────

    def score_impact(
        self,
        ml_detections: list[str],
        text_content: str,
        category: str = "general_eco_action",
    ) -> CO2ImpactResult:
        """
        Score the environmental impact of a verified eco-action.

        Args:
            ml_detections: List of object labels detected by YOLO/ML models
            text_content:  Post description text
            category:      Eco action category slug from the ML verdict

        Returns:
            CO2ImpactResult with action_type, scale, and co2_offset_kg
        """
        action_type = self._classify_action(ml_detections, text_content, category)
        scale = self._estimate_scale(text_content, ml_detections)
        base_impact = IMPACT_TABLE.get(action_type, IMPACT_TABLE["general_eco_action"])
        total_co2_kg = base_impact * scale
        confidence = self._impact_confidence(ml_detections, action_type)
        tier = self._co2_tier(total_co2_kg)

        logger.info(
            "CO2Impact: action=%s scale=%.1f base=%.1f total=%.2f kg CO₂e (%s)",
            action_type, scale, base_impact, total_co2_kg, tier,
        )

        return CO2ImpactResult(
            action_type=action_type,
            category=category,
            scale=scale,
            co2_offset_kg=round(total_co2_kg, 2),
            confidence=confidence,
            tier=tier,
            components={
                "base_impact_kg_per_unit": base_impact,
                "scale":                   scale,
                "action_type":             action_type,
            },
        )


# Singleton
co2_impact_scorer = CO2ImpactScorer()
