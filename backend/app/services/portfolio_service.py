"""
Portfolio Service — computes and caches the Eco Portfolio from on-chain + IPFS data.

This is the backend implementation of the Eco Portfolio system described in
planning/02_ECO_PORTFOLIO_SYSTEM.md.

Data sources:
  - On-chain events: RewardToken transfers, Verification verdicts (via Redis cached data)
  - IPFS: Post content (for categories and CO2 estimation)
  - Redis: Computed portfolio (5-minute cache)
  - OrbitDB: Post history for streak calculation
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from .redis_service import redis_service

logger = logging.getLogger(__name__)

# ─── CO₂ Offset Table (kg per verified action) ──────────────────────────────
# Based on EPA / DEFRA emission factors and published environmental research.
# Values represent estimated CO₂-equivalent offset per action instance.
CO2_OFFSETS_KG: dict[str, float] = {
    # Transport
    "public_transport":    2.6,
    "bicycle_commute":     3.1,
    "electric_vehicle":    1.8,
    "carpool":             1.5,
    "walking_commute":     3.5,
    # Nature
    "tree_planting":      15.0,
    "garden_creation":     5.0,
    "habitat_restoration": 20.0,
    "composting":          0.5,
    # Waste reduction
    "recycling_electronics": 5.0,
    "recycling_general":     1.0,
    "beach_cleanup":         3.0,
    "zero_waste_shopping":   0.8,
    "clothing_repair":       2.0,
    # Energy
    "solar_panel":           50.0,
    "energy_efficient_appliance": 10.0,
    "home_insulation":       30.0,
    "led_lighting":          0.5,
    # Water
    "rainwater_collection":  2.0,
    "water_conservation":    0.3,
    # Default fallback
    "general_eco":           1.0,
}

# Category groupings for the portfolio breakdown display
CATEGORY_GROUPS: dict[str, list[str]] = {
    "transport": ["public_transport", "bicycle_commute", "electric_vehicle", "carpool", "walking_commute"],
    "nature":    ["tree_planting", "garden_creation", "habitat_restoration", "composting"],
    "waste":     ["recycling_electronics", "recycling_general", "beach_cleanup", "zero_waste_shopping", "clothing_repair"],
    "energy":    ["solar_panel", "energy_efficient_appliance", "home_insulation", "led_lighting"],
    "water":     ["rainwater_collection", "water_conservation"],
}

# ─── Eco Level System ────────────────────────────────────────────────────────
ECO_LEVELS: list[dict] = [
    {"level": 1,  "title": "Eco Seedling",    "required": 0,    "perks": ["Basic portfolio"]},
    {"level": 2,  "title": "Green Sprout",    "required": 10,   "perks": ["Action graph visible"]},
    {"level": 3,  "title": "Nature Friend",   "required": 30,   "perks": ["Category breakdown"]},
    {"level": 4,  "title": "Earth Keeper",    "required": 75,   "perks": ["CO₂ offset display"]},
    {"level": 5,  "title": "Eco Advocate",    "required": 150,  "perks": ["Embeddable widget"]},
    {"level": 6,  "title": "Green Champion",  "required": 300,  "perks": ["PDF export"]},
    {"level": 7,  "title": "Eco Warrior",     "required": 500,  "perks": ["Voter reputation visible"]},
    {"level": 8,  "title": "Earth Guardian",  "required": 750,  "perks": ["Regional leaderboard"]},
    {"level": 9,  "title": "Planet Defender", "required": 1000, "perks": ["Credential system"]},
    {"level": 10, "title": "Eco Legend",      "required": 2000, "perks": ["DAO proposal rights"]},
    {"level": 11, "title": "Green Sage",      "required": 3500, "perks": ["Industry partner access"]},
    {"level": 12, "title": "Earth Architect", "required": 5000, "perks": ["Custom portfolio themes"]},
]

# ─── Credential Definitions ──────────────────────────────────────────────────
MILESTONE_CREDENTIALS: list[dict] = [
    {"id": "first_verified_action",   "title": "First Verified Eco Action",   "type": "milestone", "required_actions": 1},
    {"id": "streak_30_days",          "title": "30-Day Eco Streak",           "type": "milestone", "required_streak": 30},
    {"id": "streak_100_days",         "title": "100-Day Eco Streak",          "type": "milestone", "required_streak": 100},
    {"id": "streak_365_days",         "title": "365-Day Eco Streak",          "type": "milestone", "required_streak": 365},
    {"id": "actions_100",             "title": "100 Verified Actions",        "type": "milestone", "required_actions": 100},
    {"id": "actions_500",             "title": "500 Verified Actions",        "type": "milestone", "required_actions": 500},
    {"id": "co2_1_ton",               "title": "1 Ton CO₂ Offset",           "type": "milestone", "required_co2_kg": 1000},
    {"id": "co2_10_tons",             "title": "10 Tons CO₂ Offset",         "type": "milestone", "required_co2_kg": 10000},
]


# ─── Data Models ─────────────────────────────────────────────────────────────
@dataclass
class CategoryStats:
    count: int = 0
    co2_kg: float = 0.0


@dataclass
class StreakData:
    current: int = 0
    longest: int = 0
    last_action_date: Optional[str] = None


@dataclass
class CredentialInfo:
    id: str
    title: str
    credential_type: str
    earned_at: str
    tx_hash: Optional[str] = None


@dataclass
class MonthlyAction:
    month: str           # "2026-07"
    count: int = 0
    co2_kg: float = 0.0


@dataclass
class DayAction:
    date: str            # "2026-07-18"
    actions: int = 0
    eco_type: Optional[str] = None


@dataclass
class WeekData:
    week_start: str
    days: list[DayAction] = field(default_factory=list)
    total: int = 0


@dataclass
class EcoPortfolio:
    wallet: str
    username: Optional[str] = None
    avatar_cid: Optional[str] = None

    # Core stats
    total_verified_actions: int = 0
    verification_accuracy: float = 0.0
    co2_offset_kg: float = 0.0
    eco_level: int = 1
    eco_title: str = "Eco Seedling"
    next_level_actions: Optional[int] = None
    current_streak_days: int = 0
    longest_streak_days: int = 0

    # Category breakdown
    categories: dict[str, dict] = field(default_factory=dict)

    # Voting reputation
    votes_cast: int = 0
    correct_votes: int = 0
    voter_rank_percentile: Optional[int] = None

    # Contribution history
    monthly_actions: list[dict] = field(default_factory=list)
    action_graph: list[dict] = field(default_factory=list)   # 52 weeks of daily data

    # Credentials
    credentials: list[dict] = field(default_factory=list)
    claimable_credentials: list[dict] = field(default_factory=list)

    # Shareable links
    portfolio_url: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


# ─── Service ─────────────────────────────────────────────────────────────────
class PortfolioService:
    """
    Computes the Eco Portfolio for any wallet address.

    This service is the backbone of the EcoDMS "GitHub for eco-action" concept.
    It aggregates verified posts, computes CO2 offsets, calculates streaks,
    determines eco levels, and surfaces claimable credentials.
    """

    CACHE_TTL = 300  # 5 minutes

    def __init__(self):
        self._lock_map: dict[str, asyncio.Lock] = {}

    def _get_lock(self, wallet: str) -> asyncio.Lock:
        if wallet not in self._lock_map:
            self._lock_map[wallet] = asyncio.Lock()
        return self._lock_map[wallet]

    # ─── Public API ──────────────────────────────────────────

    async def get_portfolio(self, wallet: str, force_refresh: bool = False) -> dict:
        """
        Get the Eco Portfolio for a wallet. Returns cached data if available.

        Args:
            wallet: Ethereum wallet address (normalized to lowercase)
            force_refresh: Skip cache and recompute

        Returns:
            Portfolio dict ready for JSON serialization
        """
        wallet = wallet.lower()
        cache_key = f"portfolio:{wallet}"

        if not force_refresh:
            cached = redis_service.get_json(cache_key)
            if cached:
                logger.debug("Portfolio cache hit for %s", wallet)
                return cached

        async with self._get_lock(wallet):
            # Double-check after acquiring lock
            if not force_refresh:
                cached = redis_service.get_json(cache_key)
                if cached:
                    return cached

            portfolio = await self._compute_portfolio(wallet)
            portfolio_dict = portfolio.to_dict()
            redis_service.set_json(cache_key, portfolio_dict, ex=self.CACHE_TTL)
            return portfolio_dict

    async def invalidate(self, wallet: str) -> None:
        """Invalidate cached portfolio (call after new verified post)."""
        redis_service.delete(f"portfolio:{wallet.lower()}")

    async def get_action_graph(self, wallet: str) -> dict:
        """Get the 52-week contribution graph for a wallet."""
        wallet = wallet.lower()
        cache_key = f"portfolio:graph:{wallet}"
        cached = redis_service.get_json(cache_key)
        if cached:
            return cached

        graph = await self._compute_action_graph(wallet)
        redis_service.set_json(cache_key, graph, ex=self.CACHE_TTL)
        return graph

    async def get_leaderboard(self, scope: str = "global", limit: int = 50) -> list[dict]:
        """
        Get leaderboard of top eco contributors.

        Args:
            scope: "global" | "monthly" | category name
            limit: Max number of results
        """
        cache_key = f"leaderboard:{scope}:{limit}"
        cached = redis_service.get_json(cache_key)
        if cached:
            return cached

        leaderboard = await self._compute_leaderboard(scope, limit)
        redis_service.set_json(cache_key, leaderboard, ex=60)  # 1-minute cache for leaderboard
        return leaderboard

    async def get_claimable_credentials(self, wallet: str) -> list[dict]:
        """Return credentials the user has earned but not yet claimed."""
        portfolio_data = await self.get_portfolio(wallet)
        return portfolio_data.get("claimable_credentials", [])

    # ─── Computation ─────────────────────────────────────────

    async def _compute_portfolio(self, wallet: str) -> EcoPortfolio:
        """Full portfolio computation from all data sources."""
        try:
            # Import here to avoid circular deps
            from .social_service import social_service
            from .voting_service import voting_service
            from .user_service import user_service

            # Fetch data concurrently
            verified_posts_task = asyncio.create_task(
                self._get_verified_posts(wallet)
            )
            profile_task = asyncio.create_task(
                user_service.get_profile(wallet)
            )
            voting_stats_task = asyncio.create_task(
                self._get_voting_stats(wallet)
            )

            verified_posts, profile, voting_stats = await asyncio.gather(
                verified_posts_task, profile_task, voting_stats_task,
                return_exceptions=True
            )

            # Handle exceptions gracefully
            if isinstance(verified_posts, Exception):
                logger.warning("Could not fetch verified posts: %s", verified_posts)
                verified_posts = []
            if isinstance(profile, Exception):
                logger.warning("Could not fetch profile: %s", profile)
                profile = {}
            if isinstance(voting_stats, Exception):
                logger.warning("Could not fetch voting stats: %s", voting_stats)
                voting_stats = {}

            # Compute all portfolio components
            categories = self._categorize_actions(verified_posts)
            co2_total = self._compute_co2_offset(categories)
            streak_data = self._compute_streaks(verified_posts)
            level, title, next_level = self._compute_level(len(verified_posts))
            monthly = self._compute_monthly_actions(verified_posts)
            graph_weeks = self._compute_graph_weeks(verified_posts)
            earned_creds = self._check_claimable_credentials(
                len(verified_posts), streak_data, co2_total
            )

            return EcoPortfolio(
                wallet=wallet,
                username=profile.get("username") if profile else None,
                avatar_cid=profile.get("avatar_cid") if profile else None,
                total_verified_actions=len(verified_posts),
                verification_accuracy=voting_stats.get("accuracy", 0.0),
                co2_offset_kg=round(co2_total, 2),
                eco_level=level,
                eco_title=title,
                next_level_actions=next_level,
                current_streak_days=streak_data.current,
                longest_streak_days=streak_data.longest,
                categories={k: {"count": v.count, "co2_kg": round(v.co2_kg, 2)} for k, v in categories.items()},
                votes_cast=voting_stats.get("votes_cast", 0),
                correct_votes=voting_stats.get("correct_votes", 0),
                voter_rank_percentile=voting_stats.get("rank_percentile"),
                monthly_actions=[{"month": m.month, "count": m.count, "co2_kg": round(m.co2_kg, 2)} for m in monthly],
                action_graph=[{"week_start": w.week_start, "days": [{"date": d.date, "actions": d.actions, "eco_type": d.eco_type} for d in w.days], "total": w.total} for w in graph_weeks],
                claimable_credentials=[c for c in earned_creds],
                portfolio_url=f"https://ecodms.app/portfolio/{wallet}",
            )

        except Exception as e:
            logger.error("Portfolio computation failed for %s: %s", wallet, e, exc_info=True)
            # Return minimal portfolio on error — never crash
            return EcoPortfolio(wallet=wallet)

    async def _get_verified_posts(self, wallet: str) -> list[dict]:
        """Fetch all ML-verified posts for a wallet from OrbitDB/Redis cache."""
        try:
            # Try Redis cache first (posted by verify_routes when verdicts come in)
            cache_key = f"verified_posts:{wallet}"
            cached = redis_service.get_json(cache_key)
            if cached:
                return cached

            # Fall back to social_service which reads from OrbitDB/IPFS
            from .social_service import social_service
            posts_data = await social_service.get_user_posts(wallet, limit=500)
            posts = posts_data if isinstance(posts_data, list) else posts_data.get("posts", [])
            verified = [p for p in posts if p.get("verified") is True or p.get("verification_status") == "verified"]
            return verified
        except Exception as e:
            logger.warning("Could not fetch verified posts: %s", e)
            return []

    async def _get_voting_stats(self, wallet: str) -> dict:
        """Fetch community voting stats for a wallet."""
        try:
            from .voting_service import voting_service
            stats = await voting_service.get_user_voting_stats(wallet)
            return stats or {}
        except Exception as e:
            logger.debug("Voting stats unavailable: %s", e)
            return {}

    # ─── CO2 & Categories ────────────────────────────────────

    def _categorize_actions(self, posts: list[dict]) -> dict[str, CategoryStats]:
        """Categorize verified posts by eco-action type and sum CO2 offsets."""
        categories: dict[str, CategoryStats] = {
            "transport": CategoryStats(),
            "nature":    CategoryStats(),
            "waste":     CategoryStats(),
            "energy":    CategoryStats(),
            "water":     CategoryStats(),
            "other":     CategoryStats(),
        }

        for post in posts:
            action_type = self._infer_action_type(post)
            co2_kg = CO2_OFFSETS_KG.get(action_type, CO2_OFFSETS_KG["general_eco"])
            category = self._get_category_group(action_type)

            if category in categories:
                categories[category].count += 1
                categories[category].co2_kg += co2_kg
            else:
                categories["other"].count += 1
                categories["other"].co2_kg += co2_kg

        return categories

    def _infer_action_type(self, post: dict) -> str:
        """Infer the eco-action type from post content and ML verdict."""
        # Use verdict data if available
        verdict = post.get("ml_verdict") or {}
        if isinstance(verdict, dict):
            action = verdict.get("action_type") or verdict.get("category")
            if action and action in CO2_OFFSETS_KG:
                return action

        # Text-based inference
        content = (post.get("content") or "").lower()
        keywords = {
            "tree_planting":         ["tree", "plant", "sapling", "seedling", "grove"],
            "beach_cleanup":         ["beach", "cleanup", "litter", "ocean", "coast"],
            "bicycle_commute":       ["bike", "bicycle", "cycling", "cycle"],
            "public_transport":      ["bus", "train", "metro", "subway", "transit"],
            "recycling_general":     ["recycl", "recycle", "compost"],
            "solar_panel":           ["solar", "panel", "renewable"],
            "zero_waste_shopping":   ["zero waste", "reusable", "bag", "bottle"],
            "rainwater_collection":  ["rain", "water harvest", "cistern"],
        }
        for action_type, words in keywords.items():
            if any(w in content for w in words):
                return action_type

        return "general_eco"

    def _get_category_group(self, action_type: str) -> str:
        for group, actions in CATEGORY_GROUPS.items():
            if action_type in actions:
                return group
        return "other"

    def _compute_co2_offset(self, categories: dict[str, CategoryStats]) -> float:
        return sum(s.co2_kg for s in categories.values())

    # ─── Streaks ─────────────────────────────────────────────

    def _compute_streaks(self, posts: list[dict]) -> StreakData:
        """Calculate current and longest eco streaks from post history."""
        if not posts:
            return StreakData()

        # Extract unique dates
        dates = set()
        for post in posts:
            raw = post.get("created_at") or post.get("timestamp")
            if raw:
                try:
                    if isinstance(raw, (int, float)):
                        dt = datetime.fromtimestamp(raw / 1000 if raw > 1e10 else raw, tz=timezone.utc)
                    else:
                        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                    dates.add(dt.date())
                except Exception:
                    pass

        if not dates:
            return StreakData()

        sorted_dates = sorted(dates)
        today = datetime.now(timezone.utc).date()

        # Compute longest streak
        longest = 1
        current_run = 1
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                current_run += 1
                longest = max(longest, current_run)
            else:
                current_run = 1

        # Compute current streak (from today backwards)
        current = 0
        check = today
        sorted_dates_set = set(sorted_dates)
        while check in sorted_dates_set:
            current += 1
            check -= timedelta(days=1)

        # If they didn't post today, check yesterday
        if current == 0:
            check = today - timedelta(days=1)
            while check in sorted_dates_set:
                current += 1
                check -= timedelta(days=1)

        return StreakData(
            current=current,
            longest=max(longest, current),
            last_action_date=sorted_dates[-1].isoformat() if sorted_dates else None,
        )

    # ─── Level System ────────────────────────────────────────

    def _compute_level(self, total_actions: int) -> tuple[int, str, Optional[int]]:
        """Returns (level, title, actions_to_next_level)."""
        current_level = ECO_LEVELS[0]
        for lv in ECO_LEVELS:
            if total_actions >= lv["required"]:
                current_level = lv
            else:
                break

        # Find next level
        idx = ECO_LEVELS.index(current_level)
        next_lv = ECO_LEVELS[idx + 1] if idx + 1 < len(ECO_LEVELS) else None
        next_required = next_lv["required"] - total_actions if next_lv else None

        return current_level["level"], current_level["title"], next_required

    # ─── Monthly & Graph ─────────────────────────────────────

    def _compute_monthly_actions(self, posts: list[dict]) -> list[MonthlyAction]:
        """Aggregate verified posts by month for the bar chart."""
        monthly: dict[str, MonthlyAction] = {}

        for post in posts:
            raw = post.get("created_at") or post.get("timestamp")
            if not raw:
                continue
            try:
                if isinstance(raw, (int, float)):
                    dt = datetime.fromtimestamp(raw / 1000 if raw > 1e10 else raw, tz=timezone.utc)
                else:
                    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                key = dt.strftime("%Y-%m")
                if key not in monthly:
                    monthly[key] = MonthlyAction(month=key)
                monthly[key].count += 1
                action_type = self._infer_action_type(post)
                monthly[key].co2_kg += CO2_OFFSETS_KG.get(action_type, 1.0)
            except Exception:
                pass

        # Return last 12 months sorted
        sorted_months = sorted(monthly.values(), key=lambda m: m.month)
        return sorted_months[-12:]

    def _compute_graph_weeks(self, posts: list[dict]) -> list[WeekData]:
        """Build 52-week GitHub-style contribution graph."""
        # Build date → (count, type) map
        day_map: dict = {}
        for post in posts:
            raw = post.get("created_at") or post.get("timestamp")
            if not raw:
                continue
            try:
                if isinstance(raw, (int, float)):
                    dt = datetime.fromtimestamp(raw / 1000 if raw > 1e10 else raw, tz=timezone.utc)
                else:
                    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                date_str = dt.strftime("%Y-%m-%d")
                action_type = self._infer_action_type(post)
                if date_str not in day_map:
                    day_map[date_str] = {"count": 0, "eco_type": action_type}
                day_map[date_str]["count"] += 1
            except Exception:
                pass

        # Generate 52-week grid
        today = datetime.now(timezone.utc).date()
        # Start from the Sunday 52 weeks ago
        start = today - timedelta(weeks=52)
        # Align to Sunday
        start = start - timedelta(days=start.weekday() + 1 if start.weekday() != 6 else 0)

        weeks = []
        current = start
        while current <= today:
            week_days = []
            for i in range(7):
                day = current + timedelta(days=i)
                date_str = day.isoformat()
                day_data = day_map.get(date_str, {})
                week_days.append(DayAction(
                    date=date_str,
                    actions=day_data.get("count", 0),
                    eco_type=day_data.get("eco_type") if day_data.get("count", 0) > 0 else None,
                ))
            week_total = sum(d.actions for d in week_days)
            weeks.append(WeekData(
                week_start=current.isoformat(),
                days=week_days,
                total=week_total,
            ))
            current += timedelta(weeks=1)

        return weeks

    # ─── Credentials ─────────────────────────────────────────

    def _check_claimable_credentials(
        self,
        total_actions: int,
        streak: StreakData,
        co2_kg: float,
    ) -> list[dict]:
        """Return list of credentials the user qualifies for."""
        claimable = []
        for cred in MILESTONE_CREDENTIALS:
            earned = False
            if "required_actions" in cred and total_actions >= cred["required_actions"]:
                earned = True
            if "required_streak" in cred and streak.longest >= cred["required_streak"]:
                earned = True
            if "required_co2_kg" in cred and co2_kg >= cred["required_co2_kg"]:
                earned = True
            if earned:
                claimable.append({
                    "id":    cred["id"],
                    "title": cred["title"],
                    "type":  cred["type"],
                })
        return claimable

    async def _compute_action_graph(self, wallet: str) -> dict:
        """Standalone action graph computation."""
        verified_posts = await self._get_verified_posts(wallet)
        graph_weeks = self._compute_graph_weeks(verified_posts)
        max_daily = max(
            (d.actions for w in graph_weeks for d in w.days),
            default=0
        )
        return {
            "wallet": wallet,
            "weeks": [{"week_start": w.week_start, "days": [{"date": d.date, "actions": d.actions, "eco_type": d.eco_type} for d in w.days], "total": w.total} for w in graph_weeks],
            "max_daily": max_daily,
            "total_year": sum(w.total for w in graph_weeks),
        }

    async def _compute_leaderboard(self, scope: str, limit: int) -> list[dict]:
        """Compute leaderboard (simplified — in production this would use The Graph)."""
        try:
            from .user_service import user_service
            all_users = await user_service.get_all_users()
            entries = []
            for user in (all_users if isinstance(all_users, list) else []):
                wallet = user.get("wallet_address") or user.get("wallet")
                if not wallet:
                    continue
                try:
                    p_data = redis_service.get_json(f"portfolio:{wallet.lower()}")
                    if p_data:
                        entries.append({
                            "wallet":          wallet,
                            "username":        user.get("username") or wallet[:8] + "...",
                            "avatar_cid":      user.get("avatar_cid"),
                            "total_verified_actions": p_data.get("total_verified_actions", 0),
                            "co2_offset_kg":   p_data.get("co2_offset_kg", 0.0),
                            "eco_level":       p_data.get("eco_level", 1),
                            "eco_title":       p_data.get("eco_title", "Eco Seedling"),
                            "current_streak":  p_data.get("current_streak_days", 0),
                        })
                except Exception:
                    pass

            # Sort by verified actions
            entries.sort(key=lambda e: e["total_verified_actions"], reverse=True)
            return entries[:limit]
        except Exception as e:
            logger.error("Leaderboard computation failed: %s", e)
            return []


# Singleton instance
portfolio_service = PortfolioService()
