"""
Fraud Pipeline Orchestrator
============================
Runs all fraud checks and returns a single aggregated verdict.

Usage in worker.py:
    from backend.ml.fraud.pipeline import fraud_pipeline
    fraud_result = fraud_pipeline.run(
        image_bytes=image_bytes,
        post_cid=post_cid,
        wallet=wallet,
        text_content=text_content,
    )
    if fraud_result.block:
        # Reject the post
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from .duplicate_detector import duplicate_detector
from .exif_analyzer import exif_analyzer
from .temporal_analyzer import temporal_analyzer
from .ai_detector import ai_detector
from .impact_scorer import impact_scorer

logger = logging.getLogger(__name__)


@dataclass
class FraudResult:
    block: bool                        # True = reject this post
    flag_for_review: bool             # True = send to human review queue
    fraud_score: int                  # 0 = clean, 100 = definite fraud
    duplicate: bool = False
    exif_suspicious: bool = False
    temporal_suspicious: bool = False
    ai_generated: bool = False
    impact_score: float = 0.0         # 0-100 positive credibility score
    impact_tier: str = "unknown"
    impact_multiplier: float = 1.0
    reasons: list[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)

    @property
    def summary(self) -> str:
        if self.block:
            return f"BLOCKED (score={self.fraud_score}): {'; '.join(self.reasons)}"
        if self.flag_for_review:
            return f"FLAGGED (score={self.fraud_score}): {'; '.join(self.reasons)}"
        return f"CLEAN (score={self.fraud_score})"


class FraudPipeline:
    """
    Orchestrates all fraud detection modules.

    Scoring:
      duplicate found    → +60 (auto-block at >= 60)
      AI-generated image → +45 (probable AI = block)
      EXIF auto-reject   → +50
      EXIF suspicious    → +20
      temporal burst     → +30
      temporal limit     → +25

    Block threshold:  fraud_score >= 60
    Review threshold: fraud_score >= 30
    """

    BLOCK_THRESHOLD = 60
    REVIEW_THRESHOLD = 30

    def run(
        self,
        image_bytes: Optional[bytes],
        post_cid: str,
        wallet: str,
        text_content: Optional[str] = None,
        category: str = "general_eco_action",
        ml_confidence: float = 1.0,
        image_count: int = 1,
        author_accuracy: float = -1.0,
    ) -> FraudResult:
        """
        Run the complete fraud detection pipeline.

        Args:
            image_bytes: Raw bytes of the primary image (None if text-only post)
            post_cid: CID of the post being verified
            wallet: Submitter's wallet address
            text_content: Optional post text

        Returns:
            FraudResult with block/flag verdict and detailed breakdown
        """
        fraud_score = 0
        reasons: list[str] = []
        details: dict = {}

        # ── 1. Duplicate Detection ────────────────────────────────
        dup_result = None
        if image_bytes:
            try:
                dup_result = duplicate_detector.check(image_bytes, post_cid, wallet)
                details["duplicate"] = {
                    "is_duplicate": dup_result.is_duplicate,
                    "hamming_distance": dup_result.hamming_distance,
                    "matched_post": dup_result.matched_post_cid,
                    "reason": dup_result.reason,
                }
                if dup_result.is_duplicate:
                    fraud_score += 60
                    reasons.append(f"Duplicate: {dup_result.reason}")
                elif dup_result.is_warning:
                    fraud_score += 15
                    reasons.append(f"Near-duplicate warning: {dup_result.reason}")
            except Exception as e:
                logger.warning("Duplicate check failed: %s", e)

        # ── 2. EXIF Analysis ─────────────────────────────────────
        exif_result = None
        if image_bytes:
            try:
                exif_result = exif_analyzer.analyze(image_bytes)
                details["exif"] = {
                    "total_score": exif_result.total_score,
                    "has_gps": exif_result.has_gps,
                    "has_timestamp": exif_result.has_timestamp,
                    "image_age_days": exif_result.image_age_days,
                    "camera_model": exif_result.camera_model,
                    "editing_software": exif_result.editing_software,
                    "reason": exif_result.reason,
                }
                if exif_result.auto_reject:
                    fraud_score += 50
                    reasons.append(f"EXIF auto-reject: {exif_result.reason}")
                elif exif_result.is_suspicious:
                    fraud_score += 20
                    reasons.append(f"EXIF suspicious: {exif_result.reason}")
            except Exception as e:
                logger.warning("EXIF analysis failed: %s", e)

        # ── 3. Temporal Pattern Analysis ─────────────────────────
        temporal_result = None
        try:
            temporal_result = temporal_analyzer.analyze(wallet)
            details["temporal"] = {
                "posts_today": temporal_result.posts_today,
                "burst_detected": temporal_result.burst_detected,
                "flags": temporal_result.flags,
                "reason": temporal_result.reason,
            }
            if temporal_result.burst_detected:
                fraud_score += 30
                reasons.append(f"Burst: {temporal_result.reason}")
            elif temporal_result.is_suspicious:
                fraud_score += 25
                reasons.append(f"Temporal: {temporal_result.reason}")
        except Exception as e:
            logger.warning("Temporal analysis failed: %s", e)

        # ── 4. AI-Generated Image Detection ──────────────────────
        ai_result = None
        if image_bytes:
            try:
                ai_result = ai_detector.detect(image_bytes)
                details["ai_detection"] = {
                    "is_ai_generated": ai_result.is_ai_generated,
                    "confidence": ai_result.confidence,
                    "fraud_score_contribution": ai_result.fraud_score,
                    "signals": ai_result.signals,
                    "reason": ai_result.reason,
                }
                if ai_result.fraud_score > 0:
                    fraud_score += ai_result.fraud_score
                    if ai_result.is_ai_generated:
                        reasons.append(f"AI-generated: {ai_result.reason}")
                    elif ai_result.confidence > 0.2:
                        reasons.append(f"AI signals detected: {ai_result.reason}")
            except Exception as e:
                logger.warning("AI detection failed: %s", e)

        # ── 5. Impact Scoring (positive credibility) ──────────────
        impact_result = None
        try:
            impact_result = impact_scorer.score(
                ml_confidence=ml_confidence,
                category=category,
                image_count=image_count,
                text_content=text_content,
                author_accuracy=author_accuracy,
            )
            details["impact"] = {
                "value": impact_result.value,
                "multiplier": impact_result.multiplier,
                "tier": impact_result.tier,
                "components": impact_result.components,
            }
        except Exception as e:
            logger.warning("Impact scoring failed: %s", e)

        # ── Final Verdict ─────────────────────────────────────────
        # Cap at 100 to prevent overflow from multiple triggers
        fraud_score = min(fraud_score, 100)
        block = fraud_score >= self.BLOCK_THRESHOLD
        flag = not block and fraud_score >= self.REVIEW_THRESHOLD

        result = FraudResult(
            block=block,
            flag_for_review=flag,
            fraud_score=fraud_score,
            duplicate=bool(dup_result and dup_result.is_duplicate),
            exif_suspicious=bool(exif_result and exif_result.is_suspicious),
            temporal_suspicious=bool(temporal_result and temporal_result.is_suspicious),
            ai_generated=bool(ai_result and ai_result.is_ai_generated),
            impact_score=impact_result.value if impact_result else 0.0,
            impact_tier=impact_result.tier if impact_result else "unknown",
            impact_multiplier=impact_result.multiplier if impact_result else 1.0,
            reasons=reasons,
            details=details,
        )
        logger.info(
            "FraudPipeline [%s] post=%s fraud=%d impact=%.1f block=%s flag=%s",
            wallet[:8], post_cid[:12], fraud_score,
            impact_result.value if impact_result else 0.0, block, flag,
        )
        return result


fraud_pipeline = FraudPipeline()
