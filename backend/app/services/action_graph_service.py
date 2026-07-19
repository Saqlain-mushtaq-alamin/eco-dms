"""
Action Graph Service
====================
Builds the 52-week contribution graph data for the Eco Portfolio
(similar to GitHub's contribution graph, but for eco-actions).

Each cell = one day. Intensity (0-4) based on number of verified
eco posts that day. Color mapped in the frontend (green gradient).

Output format matches what the ActionGraph.tsx component expects.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Number of contribution levels (0 = none, 4 = most active)
MAX_LEVEL = 4


@dataclass
class DayCell:
    date: str        # YYYY-MM-DD
    count: int       # verified posts that day
    level: int       # 0-4 intensity for color coding
    co2_kg: float    # total CO₂ offset that day
    tooltip: str     # "3 eco actions · 4.5 kg CO₂"


@dataclass
class WeekData:
    week_start: str          # Monday ISO date
    days: list[DayCell]      # 7 day cells (Mon–Sun)


@dataclass
class ActionGraphData:
    weeks: list[WeekData]    # 52 weeks, newest last
    total_active_days: int
    total_posts: int
    peak_day_count: int
    peak_day_date: Optional[str]
    # Month labels for x-axis
    month_labels: list[dict]  # [{month: "Jan", week_index: 0}, ...]


def _intensity_level(count: int, peak: int) -> int:
    """Map post count to 0-4 intensity level relative to the user's personal peak."""
    if count == 0:
        return 0
    if peak <= 1:
        return 4 if count >= 1 else 0
    ratio = count / peak
    if ratio >= 0.75:
        return 4
    if ratio >= 0.50:
        return 3
    if ratio >= 0.25:
        return 2
    return 1


def build_action_graph(
    verified_actions: list[dict],
    weeks: int = 52,
) -> ActionGraphData:
    """
    Build the 52-week action graph from a list of verified actions.

    Args:
        verified_actions: List of dicts with keys:
            - completed_at: ISO datetime string
            - co2_kg: float (optional, defaults 0.5)
        weeks: Number of weeks to include (default 52)

    Returns:
        ActionGraphData ready for frontend rendering
    """
    today = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    # Start from last Monday, going back `weeks` full weeks
    days_since_monday = today.weekday()
    graph_end = today
    graph_start = graph_end - timedelta(weeks=weeks) + timedelta(days=1)
    # Snap to Monday
    graph_start -= timedelta(days=graph_start.weekday())

    # Aggregate posts by day
    day_counts: dict[str, int] = {}
    day_co2: dict[str, float] = {}

    for action in verified_actions:
        ts = action.get("completed_at") or action.get("verified_at")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            date_key = dt.strftime("%Y-%m-%d")
            day_counts[date_key] = day_counts.get(date_key, 0) + 1
            day_co2[date_key] = day_co2.get(date_key, 0.0) + float(
                action.get("co2_kg", 0.5)
            )
        except Exception:
            pass

    peak = max(day_counts.values(), default=1)
    total_posts = sum(day_counts.values())
    peak_date = max(day_counts, key=lambda d: day_counts[d]) if day_counts else None

    # Build week-by-week structure
    week_list: list[WeekData] = []
    current = graph_start
    month_labels: list[dict] = []
    seen_months: set[int] = set()
    week_index = 0

    while current <= graph_end:
        week_days: list[DayCell] = []
        for d in range(7):
            day = current + timedelta(days=d)
            date_str = day.strftime("%Y-%m-%d")
            count = day_counts.get(date_str, 0)
            co2 = round(day_co2.get(date_str, 0.0), 2)
            level = _intensity_level(count, peak)

            if count == 0:
                tooltip = day.strftime("%b %d, %Y") + " · No activity"
            elif count == 1:
                tooltip = f"{day.strftime('%b %d, %Y')} · 1 eco action · {co2} kg CO₂"
            else:
                tooltip = f"{day.strftime('%b %d, %Y')} · {count} eco actions · {co2} kg CO₂"

            week_days.append(DayCell(
                date=date_str,
                count=count,
                level=level,
                co2_kg=co2,
                tooltip=tooltip,
            ))

            # Track month label (show when month first appears)
            if day.month not in seen_months and day <= graph_end:
                seen_months.add(day.month)
                month_labels.append({
                    "month": day.strftime("%b"),
                    "week_index": week_index,
                })

        week_list.append(WeekData(
            week_start=current.strftime("%Y-%m-%d"),
            days=week_days,
        ))
        current += timedelta(weeks=1)
        week_index += 1

    active_days = sum(1 for c in day_counts.values() if c > 0)

    return ActionGraphData(
        weeks=week_list,
        total_active_days=active_days,
        total_posts=total_posts,
        peak_day_count=peak,
        peak_day_date=peak_date,
        month_labels=month_labels,
    )


def serialize_graph(graph: ActionGraphData) -> dict:
    """Serialize ActionGraphData to a JSON-safe dict for API responses."""
    return {
        "weeks": [
            {
                "week_start": w.week_start,
                "days": [
                    {
                        "date": d.date,
                        "count": d.count,
                        "level": d.level,
                        "co2_kg": d.co2_kg,
                        "tooltip": d.tooltip,
                    }
                    for d in w.days
                ],
            }
            for w in graph.weeks
        ],
        "total_active_days": graph.total_active_days,
        "total_posts": graph.total_posts,
        "peak_day_count": graph.peak_day_count,
        "peak_day_date": graph.peak_day_date,
        "month_labels": graph.month_labels,
    }
