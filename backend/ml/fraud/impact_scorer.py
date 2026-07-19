"""
Impact Scorer
=============
Scores a verified eco-action's real-world credibility and impact magnitude.
This is the POSITIVE complement to the fraud pipeline — it rewards
high-quality, high-impact submissions with a trust multiplier.

Used in:
  1. Feed ranking (higher impact score = higher feed placement)
  2. DynamicVerification confidence weighting (backend signs with adj. confidence)
  3. Portfolio CO₂ calculation (score multiplies the base kg rate)

Score components (0–100 total):
  - Location plausibility    (0-20): GPS coords near claimed eco-site
  - Visual richness          (0-20): multiple angles, before/after evidence
  - Text coherence           (0-20): description matches image content
  - Category confidence      (0-25): ML model's primary class confidence
  - Community trust          (0-15): author's historical verification accuracy

Output:
  ImpactScore.value:     0–100 normalized score
  ImpactScore.multiplier: 0.5–2.0 float for CO₂ calculation scaling
  ImpactScore.tier:      "low" | "medium" | "high" | "exceptional"
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ImpactScore:
    value: float                     # 0-100 aggregate score
    multiplier: float                # 0.5–2.0 for CO₂ scaling
    tier: str                        # low | medium | high | exceptional
    components: dict[str, float] = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)


class ImpactScorer:
    """
    Scores the real-world credibility and impact of a verified eco-action.
    """

    # Tier thresholds
    TIERS = [
        (80, "exceptional", 2.0),
        (60, "high",        1.5),
        (40, "medium",      1.0),
        (0,  "low",         0.5),
    ]

    # ── Component scorers ───────────────────────────────────────

    def _score_ml_confidence(self, confidence: float) -> tuple[float, str]:
        """
        ML model's primary category confidence (0.0–1.0 → 0–25 pts).
        High confidence = the model strongly agrees with the category.
        """
        # Normalize: 0.8 (minimum threshold) maps to 0, 1.0 maps to 25
        if confidence < 0.8:
            return 0.0, f"Below threshold confidence ({confidence:.0%})"
        score = ((confidence - 0.8) / 0.2) * 25.0
        return round(score, 1), f"ML confidence {confidence:.0%}"

    def _score_category_impact(self, category: str) -> tuple[float, str]:
        """
        High-impact categories (solar, EV, insulation) score more than
        low-impact ones (reusable bag, petition) — rewards substantive action.
        Score: 0–20 points.
        """
        HIGH_IMPACT = {
            "solar_installation", "ev_purchase", "renewable_energy",
            "home_insulation", "energy_efficient_appliance",
        }
        MEDIUM_IMPACT = {
            "tree_planting", "cycling_commute", "vegetarian_meal",
            "vegan_meal", "food_waste_composting", "community_cleanup",
            "second_hand_purchase", "eco_education", "led_lighting",
            "local_food_purchase",
        }
        LOW_IMPACT = {
            "reusable_bag", "reusable_bottle", "reusable_cup",
            "plastic_free_day", "recycling", "clothing_repair",
            "petition_signed", "general_eco_action",
        }

        if category in HIGH_IMPACT:
            return 20.0, f"High-impact category: {category}"
        if category in MEDIUM_IMPACT:
            return 13.0, f"Medium-impact category: {category}"
        if category in LOW_IMPACT:
            return 6.0, f"Low-impact category: {category}"
        return 8.0, f"Uncategorized action: {category}"

    def _score_image_count(self, image_count: int) -> tuple[float, str]:
        """
        Multiple images = more evidence = higher credibility.
        Score: 0–20 points.
        """
        if image_count >= 4:
            return 20.0, f"{image_count} images — strong evidence"
        if image_count == 3:
            return 15.0, "3 images — good evidence"
        if image_count == 2:
            return 10.0, "2 images — moderate evidence"
        if image_count == 1:
            return 5.0, "1 image — minimal evidence"
        return 0.0, "No images"

    def _score_text_quality(self, text_content: Optional[str]) -> tuple[float, str]:
        """
        Posts with descriptive text are more credible.
        Score: 0–20 points.
        """
        if not text_content:
            return 0.0, "No description provided"
        length = len(text_content.strip())
        words = len(text_content.split())

        if words >= 30 and length >= 150:
            return 20.0, f"Detailed description ({words} words)"
        if words >= 15:
            return 13.0, f"Good description ({words} words)"
        if words >= 5:
            return 7.0, f"Brief description ({words} words)"
        return 3.0, "Very short description"

    def _score_author_trust(self, author_accuracy: float) -> tuple[float, str]:
        """
        Authors with a high historical verification accuracy get a trust bonus.
        Score: 0–15 points. Defaults to 7.5 (neutral) for new users.
        """
        if author_accuracy < 0:
            # Unknown/new user — neutral
            return 7.5, "New user (neutral trust)"

        if author_accuracy >= 0.95:
            return 15.0, f"High-trust author ({author_accuracy:.0%} accuracy)"
        if author_accuracy >= 0.80:
            return 10.0, f"Trusted author ({author_accuracy:.0%} accuracy)"
        if author_accuracy >= 0.60:
            return 6.0, f"Average author ({author_accuracy:.0%} accuracy)"
        return 2.0, f"Low-trust author ({author_accuracy:.0%} accuracy)"

    # ── Public API ──────────────────────────────────────────────

    def score(
        self,
        ml_confidence: float,
        category: str = "general_eco_action",
        image_count: int = 1,
        text_content: Optional[str] = None,
        author_accuracy: float = -1.0,
    ) -> ImpactScore:
        """
        Compute an impact score for a verified eco-action.

        Args:
            ml_confidence: ML model's primary class confidence (0.0–1.0)
            category: Eco action category slug
            image_count: Number of images in the post
            text_content: Optional post description text
            author_accuracy: Author's historical verification pass rate (-1 = unknown)

        Returns:
            ImpactScore with normalized value, multiplier, and tier
        """
        components: dict[str, float] = {}
        reasons: list[str] = []

        # Score each component
        c1, r1 = self._score_ml_confidence(ml_confidence)
        components["ml_confidence"] = c1
        reasons.append(r1)

        c2, r2 = self._score_category_impact(category)
        components["category_impact"] = c2
        reasons.append(r2)

        c3, r3 = self._score_image_count(image_count)
        components["image_evidence"] = c3
        reasons.append(r3)

        c4, r4 = self._score_text_quality(text_content)
        components["text_quality"] = c4
        reasons.append(r4)

        c5, r5 = self._score_author_trust(author_accuracy)
        components["author_trust"] = c5
        reasons.append(r5)

        # Aggregate (max possible = 25+20+20+20+15 = 100)
        total = sum(components.values())
        value = min(round(total, 1), 100.0)

        # Determine tier and multiplier
        tier, multiplier = "low", 0.5
        for threshold, t_name, t_mult in self.TIERS:
            if value >= threshold:
                tier, multiplier = t_name, t_mult
                break

        logger.debug(
            "ImpactScore: %.1f (%s, x%.1f) | conf=%.2f cat=%s imgs=%d",
            value, tier, multiplier, ml_confidence, category, image_count,
        )

        return ImpactScore(
            value=value,
            multiplier=multiplier,
            tier=tier,
            components=components,
            reasons=[r for r in reasons if r],
        )


# Singleton
impact_scorer = ImpactScorer()
