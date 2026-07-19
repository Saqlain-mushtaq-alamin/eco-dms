"""
Streak Service
==============
Computes current and longest eco-action streaks from a wallet's verified
post history.

A "streak" is a consecutive-day chain of eco posts. Missing a day
resets the current streak but preserves the longest-ever streak.

All timestamps are stored as ISO-8601 UTC strings in the verification
status Redis keys (verification_status:{post_cid}).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class StreakResult:
    current_streak_days: int
    longest_streak_days: int
    last_active_date: Optional[str]   # ISO date string YYYY-MM-DD
    is_active_today: bool
    streak_at_risk: bool              # True if last post was yesterday (need to post today)
    weekly_completion: int            # Days active in last 7 days


class StreakService:
    """Computes activity streaks from verified post timestamps."""

    def compute(self, verified_dates: list[str]) -> StreakResult:
        """
        Compute streak metrics from a list of ISO-8601 UTC date strings.

        Args:
            verified_dates: List of ISO datetime strings (completed_at from Redis)

        Returns:
            StreakResult with all streak metrics
        """
        if not verified_dates:
            return StreakResult(
                current_streak_days=0,
                longest_streak_days=0,
                last_active_date=None,
                is_active_today=False,
                streak_at_risk=False,
                weekly_completion=0,
            )

        # Parse and deduplicate to date-level precision (UTC)
        unique_dates: set[datetime] = set()
        for ts in verified_dates:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                # Normalize to date-only UTC midnight
                day = dt.replace(hour=0, minute=0, second=0, microsecond=0,
                                  tzinfo=timezone.utc)
                unique_dates.add(day)
            except Exception:
                pass

        if not unique_dates:
            return StreakResult(0, 0, None, False, False, 0)

        sorted_days = sorted(unique_dates)
        today = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # ── Compute longest + current streak ──────────────────
        longest = 1
        current_run = 1

        for i in range(1, len(sorted_days)):
            diff = (sorted_days[i] - sorted_days[i - 1]).days
            if diff == 1:
                current_run += 1
                longest = max(longest, current_run)
            elif diff > 1:
                current_run = 1

        # Current streak: walk backward from today
        current_streak = 0
        check_day = today
        day_set = set(sorted_days)

        while check_day in day_set:
            current_streak += 1
            check_day -= timedelta(days=1)

        # If nothing today, check if yesterday was last (streak at risk)
        yesterday = today - timedelta(days=1)
        if current_streak == 0 and yesterday in day_set:
            # Streak is still alive but user must post today
            # Walk back from yesterday
            check_day = yesterday
            while check_day in day_set:
                current_streak += 1
                check_day -= timedelta(days=1)

        last_day = sorted_days[-1]
        is_active_today = today in day_set
        streak_at_risk = (not is_active_today) and (yesterday in day_set)

        # ── Weekly completion (days active in last 7 days) ────
        week_start = today - timedelta(days=6)
        weekly_completion = sum(
            1 for d in sorted_days if week_start <= d <= today
        )

        return StreakResult(
            current_streak_days=current_streak,
            longest_streak_days=max(longest, current_streak),
            last_active_date=last_day.strftime("%Y-%m-%d"),
            is_active_today=is_active_today,
            streak_at_risk=streak_at_risk,
            weekly_completion=weekly_completion,
        )


streak_service = StreakService()
