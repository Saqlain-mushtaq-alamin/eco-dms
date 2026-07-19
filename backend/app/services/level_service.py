"""
Level Service
=============
Maps verified-action counts and CO₂ offsets to Eco Levels (1–20).
Each level unlocks new platform features and governance rights.

Level thresholds are deliberately non-linear — growth slows at higher
levels to make top-tier status genuinely rare and meaningful.

Level titles are aligned with the real-world environmental impact
progression described in planning/01_VISION_AND_IDENTITY.md.
"""
from __future__ import annotations

from dataclasses import dataclass

# (min_actions, min_kg_co2, level, title, unlocks)
LEVEL_TABLE: list[tuple[int, float, int, str, str]] = [
    (0,    0.0,    1,  "Eco Seedling",    "Basic platform access"),
    (3,    1.0,    2,  "Eco Sprout",      "Profile badge"),
    (7,    5.0,    3,  "Eco Sapling",     "Comment on eco posts"),
    (15,   15.0,   4,  "Eco Leaf",        "Boost posts (tier 1)"),
    (25,   30.0,   5,  "Green Citizen",   "Action graph unlocked"),
    (40,   60.0,   6,  "Eco Activist",    "CO₂ certificate download"),
    (60,   100.0,  7,  "Earth Steward",   "Community voting rights"),
    (85,   160.0,  8,  "Green Pioneer",   "Boost posts (tier 2)"),
    (120,  250.0,  9,  "Eco Champion",    "Portfolio shareable link"),
    (160,  400.0,  10, "Earth Guardian",  "DAO proposal rights"),
    (210,  600.0,  11, "Climate Warrior", "Boost posts (tier 3)"),
    (275,  900.0,  12, "Eco Veteran",     "Credential: Eco Veteran"),
    (350,  1300.0, 13, "Green Sage",      "Admin nomination eligible"),
    (440,  1800.0, 14, "Earth Keeper",    "Impact leaderboard featured"),
    (550,  2500.0, 15, "Eco Elder",       "Annual credential eligible"),
    (680,  3500.0, 16, "Climate Hero",    "Partner programme access"),
    (830,  5000.0, 17, "Earth Protector", "Cross-chain credential"),
    (1000, 7000.0, 18, "Eco Legend",      "Hall of Fame eligible"),
    (1250, 10000.0,19, "Green Oracle",    "Platform co-governance"),
    (1500, 15000.0,20, "Earth Champion",  "Lifetime impact seal"),
]


@dataclass
class LevelResult:
    level: int
    title: str
    unlocks: str
    total_verified_actions: int
    total_kg_co2: float
    # Progress to next level
    next_level: int
    actions_to_next: int       # 0 if at max level
    co2_to_next: float         # 0.0 if at max level
    actions_progress_pct: float
    co2_progress_pct: float


def get_level(total_actions: int, total_kg_co2: float) -> LevelResult:
    """
    Determine a user's eco level from their verified action count and CO₂ offset.

    Level is gated by BOTH action count AND CO₂ offset — you can't farm
    low-impact actions to skip levels.

    Args:
        total_actions: Total number of ML-verified eco posts
        total_kg_co2: Total kg CO₂ offset across all verified actions

    Returns:
        LevelResult with current level, title, and next-level progress
    """
    current_row = LEVEL_TABLE[0]
    for row in LEVEL_TABLE:
        min_actions, min_kg, *_ = row
        if total_actions >= min_actions and total_kg_co2 >= min_kg:
            current_row = row
        else:
            break

    min_act, min_co2, level, title, unlocks = current_row

    # Next level thresholds
    next_idx = min(level, len(LEVEL_TABLE) - 1)  # level is 1-indexed
    if level < 20:
        next_row = LEVEL_TABLE[next_idx]
        next_min_act, next_min_co2 = next_row[0], next_row[1]
        next_level = next_row[2]

        actions_to_next = max(0, next_min_act - total_actions)
        co2_to_next = max(0.0, next_min_co2 - total_kg_co2)

        # Progress percentages (clamped 0–100)
        act_range = next_min_act - min_act
        co2_range = next_min_co2 - min_co2
        actions_progress_pct = min(100.0, (total_actions - min_act) / act_range * 100) if act_range > 0 else 100.0
        co2_progress_pct = min(100.0, (total_kg_co2 - min_co2) / co2_range * 100) if co2_range > 0 else 100.0
    else:
        next_level = 20
        actions_to_next = 0
        co2_to_next = 0.0
        actions_progress_pct = 100.0
        co2_progress_pct = 100.0

    return LevelResult(
        level=level,
        title=title,
        unlocks=unlocks,
        total_verified_actions=total_actions,
        total_kg_co2=total_kg_co2,
        next_level=next_level,
        actions_to_next=actions_to_next,
        co2_to_next=round(co2_to_next, 2),
        actions_progress_pct=round(actions_progress_pct, 1),
        co2_progress_pct=round(co2_progress_pct, 1),
    )
