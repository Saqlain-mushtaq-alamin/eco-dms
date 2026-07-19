"""
Perceptual Hash Duplicate Detector
===================================
Detects duplicate or near-duplicate eco-action images.

Why this matters:
  A user who recycles electronics once cannot submit the same photo 50 times
  to farm ECO tokens. Perceptual hashing detects exact and near-exact duplicates
  even after cropping, resizing, or adding minor visual noise.

Algorithm:
  - Uses pHash (perceptual hash) via imagehash library
  - A Hamming distance <= 8 out of 64 bits = duplicate (87.5% similarity)
  - Hashes stored in Redis as {phash: original_post_cid}
  - Also cross-checks within a user's submission history

Storage strategy:
  - Redis SET per wallet: eco:phash:{wallet} → {phash}
  - Global Redis HASH: eco:phash:global → {phash: post_cid}
  - TTL: 1 year (eco-actions are long-lived credentials)
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# Max Hamming distance (out of 64 bits) to call it a duplicate
DUPLICATE_THRESHOLD = 8
# Near-duplicate warning threshold (may be same scene, different angle)
WARNING_THRESHOLD = 15


@dataclass
class DuplicateResult:
    is_duplicate: bool
    is_warning: bool
    hamming_distance: Optional[int]
    matched_post_cid: Optional[str]
    matched_wallet: Optional[str]
    phash: Optional[str]
    reason: str


class DuplicateDetector:
    """
    Detects exact and near-duplicate eco-action images.
    Uses perceptual hashing (pHash) for robust detection.
    """

    def __init__(self):
        self._imagehash = None
        self._PIL = None
        self._redis = None
        self._available = False
        self._init()

    def _init(self):
        try:
            import imagehash
            from PIL import Image
            self._imagehash = imagehash
            self._PIL = Image
            self._available = True
            logger.info("DuplicateDetector initialized with imagehash + Pillow")
        except ImportError as e:
            logger.warning("DuplicateDetector unavailable: %s. Install imagehash + Pillow.", e)

        try:
            from backend.app.services.redis_service import redis_service
            self._redis = redis_service
        except Exception as e:
            logger.warning("DuplicateDetector: Redis unavailable: %s", e)

    def _compute_phash(self, image_bytes: bytes) -> Optional[str]:
        """Compute perceptual hash of image bytes."""
        if not self._available:
            return None
        try:
            img = self._PIL.Image.open(io.BytesIO(image_bytes)).convert("RGB")
            phash = self._imagehash.phash(img, hash_size=8)
            return str(phash)
        except Exception as e:
            logger.debug("pHash computation failed: %s", e)
            return None

    def _redis_lookup(self, phash_str: str) -> tuple[Optional[str], Optional[str]]:
        """Look up a phash in Redis. Returns (post_cid, wallet) or (None, None)."""
        if not self._redis:
            return None, None
        try:
            raw = self._redis.client.hget("eco:phash:global", phash_str)
            if raw:
                parts = raw.decode() if isinstance(raw, bytes) else str(raw)
                if ":" in parts:
                    post_cid, wallet = parts.split(":", 1)
                    return post_cid, wallet
                return parts, None
        except Exception as e:
            logger.debug("Redis phash lookup error: %s", e)
        return None, None

    def _redis_store(self, phash_str: str, post_cid: str, wallet: str) -> None:
        """Store a phash in Redis for future lookups."""
        if not self._redis:
            return
        try:
            value = f"{post_cid}:{wallet}"
            self._redis.client.hset("eco:phash:global", phash_str, value)
            # Also track per-wallet
            self._redis.client.sadd(f"eco:phash:{wallet.lower()}", phash_str)
        except Exception as e:
            logger.debug("Redis phash store error: %s", e)

    def _hamming(self, hash1: str, hash2: str) -> int:
        """Compute Hamming distance between two hex hash strings."""
        if not self._imagehash:
            return 999
        try:
            h1 = self._imagehash.hex_to_hash(hash1)
            h2 = self._imagehash.hex_to_hash(hash2)
            return h1 - h2
        except Exception:
            return 999

    def check(
        self,
        image_bytes: bytes,
        post_cid: str,
        wallet: str,
    ) -> DuplicateResult:
        """
        Check if this image is a duplicate of a previously submitted image.

        Args:
            image_bytes: Raw image bytes
            post_cid: CID of the post being checked
            wallet: Wallet address of submitter

        Returns:
            DuplicateResult with verdict and details
        """
        if not self._available:
            return DuplicateResult(
                is_duplicate=False, is_warning=False, hamming_distance=None,
                matched_post_cid=None, matched_wallet=None, phash=None,
                reason="Duplicate detection unavailable (imagehash not installed)"
            )

        phash_str = self._compute_phash(image_bytes)
        if not phash_str:
            return DuplicateResult(
                is_duplicate=False, is_warning=False, hamming_distance=None,
                matched_post_cid=None, matched_wallet=None, phash=None,
                reason="Could not compute image hash"
            )

        # Exact match first
        matched_cid, matched_wallet = self._redis_lookup(phash_str)
        if matched_cid and matched_cid != post_cid:
            self._redis_store(phash_str, post_cid, wallet)
            return DuplicateResult(
                is_duplicate=True, is_warning=False, hamming_distance=0,
                matched_post_cid=matched_cid, matched_wallet=matched_wallet,
                phash=phash_str,
                reason=f"Exact duplicate of post {matched_cid[:12]}..."
            )

        # Near-duplicate scan within user's history
        best_distance = 999
        best_cid = None
        if self._redis:
            try:
                user_hashes = self._redis.client.smembers(f"eco:phash:{wallet.lower()}")
                for stored_hash_bytes in (user_hashes or set()):
                    stored_hash = (
                        stored_hash_bytes.decode()
                        if isinstance(stored_hash_bytes, bytes)
                        else str(stored_hash_bytes)
                    )
                    dist = self._hamming(phash_str, stored_hash)
                    if dist < best_distance:
                        best_distance = dist
                        best_cid, _ = self._redis_lookup(stored_hash)
            except Exception as e:
                logger.debug("Near-duplicate scan error: %s", e)

        # Store this hash for future checks
        self._redis_store(phash_str, post_cid, wallet)

        if best_distance <= DUPLICATE_THRESHOLD:
            return DuplicateResult(
                is_duplicate=True, is_warning=False, hamming_distance=best_distance,
                matched_post_cid=best_cid, matched_wallet=wallet, phash=phash_str,
                reason=f"Near-duplicate detected (distance={best_distance}, threshold={DUPLICATE_THRESHOLD})"
            )

        if best_distance <= WARNING_THRESHOLD:
            return DuplicateResult(
                is_duplicate=False, is_warning=True, hamming_distance=best_distance,
                matched_post_cid=best_cid, matched_wallet=wallet, phash=phash_str,
                reason=f"Similar image found (distance={best_distance}) — manual review may be needed"
            )

        return DuplicateResult(
            is_duplicate=False, is_warning=False, hamming_distance=best_distance,
            matched_post_cid=None, matched_wallet=None, phash=phash_str,
            reason="No duplicate found"
        )


# Singleton
duplicate_detector = DuplicateDetector()
