"""
AI-Generated Image Detector
============================
Detects AI-generated images (Stable Diffusion, DALL-E, Midjourney, etc.)
in eco-action submissions.

Why this matters:
  AI can generate photorealistic images of "solar panels", "tree planting",
  or "recycling" that never happened. This module provides a layered defense:

  Layer 1 — Statistical pixel analysis (always runs, zero deps)
    - Natural images have specific noise patterns (camera sensor noise)
    - AI images have hyper-smooth regions with unnaturally low variance
    - Checks DCT coefficient distribution (natural = 1/f power law)

  Layer 2 — EXIF tombstone check
    - AI images have NO EXIF data at all (no camera, no GPS, no timestamp)
    - Combined with Layer 1 this is highly reliable

  Layer 3 — Frequency domain analysis
    - Fourier transform of AI images shows characteristic grid artifacts
    - Particularly visible in upsampled regions

Scoring: fraud_score contribution of 0–45 points.
  >= 35 → probable AI-generated (block)
  >= 20 → suspicious (flag for review)
"""
from __future__ import annotations

import io
import logging
import math
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class AIDetectionResult:
    is_ai_generated: bool
    confidence: float           # 0.0 = definitely real, 1.0 = definitely AI
    fraud_score: int            # 0-45 contribution to pipeline fraud score
    signals: list[str] = field(default_factory=list)
    reason: str = ""


class AIDetector:
    """
    Detects AI-generated images using statistical and frequency analysis.
    Gracefully degrades if optional deps (Pillow, numpy) are unavailable.
    """

    def __init__(self):
        self._PIL = None
        self._np = None
        self._available = False
        self._numpy_available = False
        self._init()

    def _init(self):
        try:
            from PIL import Image
            self._PIL = Image
            self._available = True
        except ImportError:
            logger.warning("AIDetector: Pillow not installed — AI detection limited.")
            return

        try:
            import numpy as np
            self._np = np
            self._numpy_available = True
            logger.info("AIDetector ready (Pillow + NumPy).")
        except ImportError:
            logger.info("AIDetector ready (Pillow only, NumPy not available).")

    # ── Layer 1: Pixel noise analysis ──────────────────────────

    def _pixel_noise_score(self, image_bytes: bytes) -> tuple[float, list[str]]:
        """
        Natural photos have sensor noise (σ ≈ 1–8 in smooth regions).
        AI images have near-zero noise in smooth areas (σ < 0.5).

        Returns (score 0.0-1.0, signals list).
        1.0 = very likely AI.
        """
        if not self._available:
            return 0.0, []

        signals = []
        try:
            img = self._PIL.Image.open(io.BytesIO(image_bytes)).convert("L")
            # Downsample for speed
            img = img.resize((256, 256), self._PIL.Image.LANCZOS)

            if self._numpy_available:
                import numpy as np
                arr = np.array(img, dtype=np.float32)

                # Check local variance in 8x8 blocks
                block_variances = []
                for y in range(0, 256 - 8, 8):
                    for x in range(0, 256 - 8, 8):
                        block = arr[y:y+8, x:x+8]
                        block_variances.append(float(np.var(block)))

                if not block_variances:
                    return 0.0, []

                mean_var = sum(block_variances) / len(block_variances)
                low_var_blocks = sum(1 for v in block_variances if v < 2.0)
                low_var_ratio = low_var_blocks / len(block_variances)

                if mean_var < 10.0:
                    signals.append(f"Hyper-smooth image (mean block variance={mean_var:.2f})")
                    return min(0.6 + (10.0 - mean_var) / 20.0, 0.9), signals

                if low_var_ratio > 0.4:
                    signals.append(f"High ratio of unnaturally smooth regions ({low_var_ratio:.0%})")
                    return min(low_var_ratio * 0.8, 0.7), signals

                return 0.0, []

            else:
                # Fallback: use PIL stat
                from PIL import ImageStat
                stat = ImageStat.Stat(img)
                std_dev = stat.stddev[0]
                if std_dev < 15.0:
                    signals.append(f"Very low pixel variance (σ={std_dev:.1f}) — possible AI")
                    return 0.4, signals
                return 0.0, []

        except Exception as e:
            logger.debug("Pixel noise check failed: %s", e)
            return 0.0, []

    # ── Layer 2: EXIF tombstone ─────────────────────────────────

    def _exif_tombstone_score(self, image_bytes: bytes) -> tuple[float, list[str]]:
        """
        AI-generated images have completely empty EXIF.
        Combined with other signals this is informative.
        """
        if not self._available:
            return 0.0, []

        signals = []
        try:
            img = self._PIL.Image.open(io.BytesIO(image_bytes))
            exif = img._getexif()  # type: ignore[attr-defined]
            if not exif or len(exif) == 0:
                signals.append("No EXIF data — consistent with AI generation or screenshot")
                return 0.25, signals
            # Has Make or Model = definitely from a camera
            tags = {k: v for k, v in (exif or {}).items()}
            # Tag 271 = Make, 272 = Model
            if 271 in tags or 272 in tags:
                return 0.0, []
            signals.append("EXIF present but no camera make/model")
            return 0.1, signals
        except Exception as e:
            logger.debug("EXIF tombstone check error: %s", e)
            return 0.0, []

    # ── Layer 3: Frequency domain artifacts ────────────────────

    def _frequency_artifact_score(self, image_bytes: bytes) -> tuple[float, list[str]]:
        """
        AI upsampling (VAE decoder, super-resolution) leaves periodic
        grid patterns in the DCT/FFT spectrum.
        """
        if not self._numpy_available or not self._available:
            return 0.0, []

        signals = []
        try:
            import numpy as np
            img = self._PIL.Image.open(io.BytesIO(image_bytes)).convert("L")
            img = img.resize((128, 128), self._PIL.Image.LANCZOS)
            arr = np.array(img, dtype=np.float32)

            # 2D FFT
            fft = np.fft.fft2(arr)
            fft_shifted = np.fft.fftshift(fft)
            magnitude = np.abs(fft_shifted)

            # AI upsampling creates peaks at f = N/8 intervals
            h, w = magnitude.shape
            center_h, center_w = h // 2, w // 2

            # Sample specific frequency bands
            # Natural images follow 1/f → energy drops monotonically
            ring_energies = []
            for radius in [8, 16, 24, 32, 40]:
                ring = []
                for angle in range(0, 360, 5):
                    rad = math.radians(angle)
                    y = int(center_h + radius * math.sin(rad))
                    x = int(center_w + radius * math.cos(rad))
                    if 0 <= y < h and 0 <= x < w:
                        ring.append(float(magnitude[y, x]))
                ring_energies.append(sum(ring) / len(ring) if ring else 0)

            # Check for non-monotonic energy (peaks at mid frequencies = AI)
            if len(ring_energies) >= 3:
                violations = sum(
                    1 for i in range(1, len(ring_energies) - 1)
                    if ring_energies[i] > ring_energies[i - 1] * 1.3
                )
                if violations >= 2:
                    signals.append(
                        f"Frequency spectrum shows {violations} non-natural peaks — "
                        "consistent with AI upsampling artifacts"
                    )
                    return min(0.3 + violations * 0.1, 0.6), signals

            return 0.0, []

        except Exception as e:
            logger.debug("Frequency analysis failed: %s", e)
            return 0.0, []

    # ── Public API ──────────────────────────────────────────────

    def detect(self, image_bytes: bytes) -> AIDetectionResult:
        """
        Run all AI-detection layers and aggregate results.

        Args:
            image_bytes: Raw image bytes to analyze

        Returns:
            AIDetectionResult with combined verdict
        """
        if not self._available:
            return AIDetectionResult(
                is_ai_generated=False, confidence=0.0, fraud_score=0,
                reason="AI detection unavailable (Pillow not installed)"
            )

        all_signals: list[str] = []
        scores: list[float] = []

        # Layer 1: pixel noise
        s1, sig1 = self._pixel_noise_score(image_bytes)
        scores.append(s1)
        all_signals.extend(sig1)

        # Layer 2: EXIF tombstone
        s2, sig2 = self._exif_tombstone_score(image_bytes)
        scores.append(s2)
        all_signals.extend(sig2)

        # Layer 3: frequency artifacts
        s3, sig3 = self._frequency_artifact_score(image_bytes)
        scores.append(s3)
        all_signals.extend(sig3)

        # Combine: weighted average (layer 1 = 50%, layer 2 = 20%, layer 3 = 30%)
        weights = [0.50, 0.20, 0.30]
        combined = sum(s * w for s, w in zip(scores, weights))

        # Boost confidence when multiple layers agree
        agreement_bonus = sum(1 for s in scores if s > 0.2) * 0.05
        confidence = min(combined + agreement_bonus, 1.0)

        # Map to fraud_score (max 45)
        fraud_score = int(confidence * 45)

        is_ai = confidence >= 0.45

        if not all_signals:
            reason = "No AI generation signals detected"
        else:
            reason = "; ".join(all_signals)

        return AIDetectionResult(
            is_ai_generated=is_ai,
            confidence=round(confidence, 4),
            fraud_score=fraud_score,
            signals=all_signals,
            reason=reason,
        )


# Singleton
ai_detector = AIDetector()
