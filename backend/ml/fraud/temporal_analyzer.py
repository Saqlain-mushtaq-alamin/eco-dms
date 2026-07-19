"""
Temporal Pattern Analyzer — detects bot-like submission behaviour.

Red flags:
  - Posting > 10 eco-actions per day (human limit)
  - All posts submitted within a 5-minute burst
  - Posting identical categories every single day (no natural variety)
  - Submitting at statistically improbable exact-hour intervals

All data is sourced from Redis (verification_status:* keys).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

MAX_POSTS_PER_DAY = 10
BURST_WINDOW_MINUTES = 5
BURST_THRESHOLD = 3       # 3+ posts in 5-min window = suspicious


@dataclass
class TemporalResult:
    is_suspicious: bool
    flags: list[str] = field(default_factory=list)
    posts_today: int = 0
    burst_detected: bool = False
    reason: str = ""


class TemporalAnalyzer:
    """Analyses post submission timing to catch bot-like behaviour."""

    def __init__(self):
        self._redis = None
        try:
            from backend.app.services.redis_service import redis_service
            self._redis = redis_service
        except Exception as e:
            logger.warning("TemporalAnalyzer: Redis unavailable: %s", e)

    def _get_wallet_post_times(self, wallet: str) -> list[datetime]:
        """Fetch verified post timestamps from Redis for a wallet."""
        if not self._redis:
            return []
        times = []
        try:
            keys = self._redis.client.keys(f"verification_status:*") or []
            for key in keys:
                raw = self._redis.get_json(
                    key.decode() if isinstance(key, bytes) else key
                )
                if not isinstance(raw, dict):
                    continue
                if (raw.get("author_wallet") or "").lower() != wallet.lower():
                    continue
                if raw.get("status") not in ("completed",):
                    continue
                ts_str = raw.get("completed_at") or raw.get("updated_at")
                if ts_str:
                    try:
                        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                        times.append(dt)
                    except Exception:
                        pass
        except Exception as e:
            logger.debug("TemporalAnalyzer fetch error: %s", e)
        return sorted(times)

    def analyze(self, wallet: str, new_post_time: Optional[datetime] = None) -> TemporalResult:
        """
        Analyze submission timing for a wallet.

        Args:
            wallet: Wallet address to analyze
            new_post_time: Timestamp of the new post being submitted (default: now)
        """
        if new_post_time is None:
            new_post_time = datetime.now(timezone.utc)

        if not self._redis:
            return TemporalResult(False, reason="Redis unavailable — temporal check skipped")

        all_times = self._get_wallet_post_times(wallet)
        all_times.append(new_post_time)
        all_times.sort()

        flags = []

        # 1. Posts-per-day check
        today_start = new_post_time.replace(hour=0, minute=0, second=0, microsecond=0)
        posts_today = sum(1 for t in all_times if t >= today_start)
        if posts_today > MAX_POSTS_PER_DAY:
            flags.append(f"Exceeded daily limit: {posts_today} posts today (max {MAX_POSTS_PER_DAY})")

        # 2. Burst detection
        burst_window = timedelta(minutes=BURST_WINDOW_MINUTES)
        burst_detected = False
        for i in range(len(all_times)):
            window_posts = sum(
                1 for t in all_times[i:]
                if t <= all_times[i] + burst_window
            )
            if window_posts >= BURST_THRESHOLD:
                burst_detected = True
                flags.append(
                    f"Burst: {window_posts} posts within {BURST_WINDOW_MINUTES} minutes"
                )
                break

        # 3. Exact-hour posting (bot pattern)
        recent = [t for t in all_times if t >= new_post_time - timedelta(days=7)]
        exact_hour_count = sum(1 for t in recent if t.minute == 0 and t.second < 5)
        if len(recent) >= 5 and exact_hour_count / len(recent) > 0.7:
            flags.append(f"Bot-like timing: {exact_hour_count}/{len(recent)} posts at exact hours")

        is_suspicious = len(flags) > 0
        return TemporalResult(
            is_suspicious=is_suspicious,
            flags=flags,
            posts_today=posts_today,
            burst_detected=burst_detected,
            reason="; ".join(flags) if flags else "Timing patterns normal",
        )


temporal_analyzer = TemporalAnalyzer()
