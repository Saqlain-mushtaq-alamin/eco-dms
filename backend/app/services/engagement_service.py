"""
Engagement Service — collects post engagement metrics for DynamicVerification bonus claims.

After 24h, the Celery beat task calls claim_engagement_bonus() which:
  1. Reads likes/comments/views from Redis
  2. Signs an engagement verdict (EIP-712)
  3. Calls DynamicVerification.claimEngagementBonus() on-chain

This completes the Phase 2 two-phase reward system.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

ENGAGEMENT_WINDOW_HOURS = 24


@dataclass
class EngagementMetrics:
    post_cid: str
    likes: int = 0
    comments: int = 0
    views: int = 0
    shares: int = 0


class EngagementService:
    """Reads and stores post engagement metrics for bonus calculation."""

    def __init__(self):
        self._redis = None
        try:
            from backend.app.services.redis_service import redis_service
            self._redis = redis_service
        except Exception as e:
            logger.warning("EngagementService: Redis unavailable: %s", e)

    def _key(self, post_cid: str) -> str:
        return f"engagement:{post_cid}"

    def record_like(self, post_cid: str) -> None:
        """Increment like count for a post."""
        if self._redis:
            try:
                self._redis.client.hincrby(self._key(post_cid), "likes", 1)
            except Exception as e:
                logger.debug("record_like error: %s", e)

    def record_comment(self, post_cid: str) -> None:
        """Increment comment count for a post."""
        if self._redis:
            try:
                self._redis.client.hincrby(self._key(post_cid), "comments", 1)
            except Exception as e:
                logger.debug("record_comment error: %s", e)

    def record_view(self, post_cid: str) -> None:
        """Increment view count for a post (called on feed render)."""
        if self._redis:
            try:
                self._redis.client.hincrby(self._key(post_cid), "views", 1)
            except Exception as e:
                logger.debug("record_view error: %s", e)

    def record_share(self, post_cid: str) -> None:
        """Increment share count for a post."""
        if self._redis:
            try:
                self._redis.client.hincrby(self._key(post_cid), "shares", 1)
            except Exception as e:
                logger.debug("record_share error: %s", e)

    def get_metrics(self, post_cid: str) -> EngagementMetrics:
        """Get current engagement metrics for a post."""
        if not self._redis:
            return EngagementMetrics(post_cid=post_cid)
        try:
            raw = self._redis.client.hgetall(self._key(post_cid))
            if not raw:
                return EngagementMetrics(post_cid=post_cid)
            decode = lambda v: int(v.decode() if isinstance(v, bytes) else v or 0)
            return EngagementMetrics(
                post_cid=post_cid,
                likes=decode(raw.get(b"likes", 0)),
                comments=decode(raw.get(b"comments", 0)),
                views=decode(raw.get(b"views", 0)),
                shares=decode(raw.get(b"shares", 0)),
            )
        except Exception as e:
            logger.warning("get_metrics error for %s: %s", post_cid, e)
            return EngagementMetrics(post_cid=post_cid)

    def get_posts_ready_for_bonus(self) -> list[dict]:
        """
        Find all posts whose 24h engagement window has closed.
        Returns list of {post_cid, author_wallet, verified_at} dicts.
        """
        if not self._redis:
            return []
        ready = []
        try:
            keys = self._redis.client.keys("verification_status:*") or []
            now = time.time()
            for key in keys:
                key_str = key.decode() if isinstance(key, bytes) else str(key)
                raw = self._redis.get_json(key_str)
                if not isinstance(raw, dict):
                    continue
                if raw.get("status") != "completed":
                    continue
                if raw.get("bonus_claimed"):
                    continue

                completed_at_str = raw.get("completed_at")
                if not completed_at_str:
                    continue

                try:
                    from datetime import datetime, timezone
                    completed_dt = datetime.fromisoformat(
                        completed_at_str.replace("Z", "+00:00")
                    )
                    elapsed_hours = (
                        datetime.now(timezone.utc) - completed_dt
                    ).total_seconds() / 3600
                    if elapsed_hours >= ENGAGEMENT_WINDOW_HOURS:
                        post_cid = key_str.split("verification_status:", 1)[-1]
                        ready.append({
                            "post_cid": post_cid,
                            "author_wallet": raw.get("author_wallet"),
                            "verified_at": completed_at_str,
                        })
                except Exception:
                    pass
        except Exception as e:
            logger.error("get_posts_ready_for_bonus error: %s", e)
        return ready

    def mark_bonus_claimed(self, post_cid: str) -> None:
        """Mark a post's engagement bonus as claimed."""
        if not self._redis:
            return
        try:
            key = f"verification_status:{post_cid}"
            raw = self._redis.get_json(key) or {}
            raw["bonus_claimed"] = True
            self._redis.set_json(key, raw)
        except Exception as e:
            logger.debug("mark_bonus_claimed error: %s", e)


engagement_service = EngagementService()
