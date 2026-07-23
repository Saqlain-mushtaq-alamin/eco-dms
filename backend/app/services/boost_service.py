"""
Boost Service
=============
Backend service for the EcoBoost contract interaction.

Responsibilities:
  - Check if a post CID can be boosted (must be ML-verified eco post)
  - Record boost intent (user approval flow)
  - Read active boost level for a post from contract state
  - Return boost history for a post CID
  - Compute feed score multiplier based on active boost

Boost tiers (mirrors EcoBoost.sol constants):
  Spark    (1) → 5  ECO → 3x  reach for 24h
  Flame    (2) → 15 ECO → 10x reach for 48h
  Wildfire (3) → 50 ECO → 50x reach for 7d
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# Mirrors EcoBoost.sol constants (in ECO, not wei)
BOOST_TIERS: dict[int, dict] = {
    1: {"name": "Spark",    "eco_cost": 5,  "reach_multiplier": 3,  "duration_hours": 24},
    2: {"name": "Flame",    "eco_cost": 15, "reach_multiplier": 10, "duration_hours": 48},
    3: {"name": "Wildfire", "eco_cost": 50, "reach_multiplier": 50, "duration_hours": 168},
}


@dataclass
class BoostStatus:
    post_cid: str
    is_boosted: bool
    active_level: int           # 0 = not boosted
    active_tier_name: str       # "None" | "Spark" | "Flame" | "Wildfire"
    reach_multiplier: int       # 1 (unboosted) to 50
    expires_at: Optional[float] # Unix timestamp, None if not boosted
    boost_count: int            # total number of boosts ever applied
    total_eco_burned: float     # ECO burned across all boosts (in ECO units)


@dataclass
class BoostRecord:
    booster: str
    level: int
    tier_name: str
    eco_cost: float
    boosted_at: float
    expires_at: float
    is_active: bool


class BoostService:
    """
    Wraps EcoBoost.sol read calls with a Redis cache layer.
    All writes go directly to the contract via the frontend (wallet approval).
    """

    CACHE_TTL = 60  # 1-minute cache for boost status

    def _get_redis(self):
        from ..services.redis_service import redis_service
        return redis_service

    def _get_web3(self):
        """Lazy-load Web3 connection."""
        import os
        from web3 import Web3
        rpc = os.getenv("RPC_URL") or os.getenv("HARDHAT_RPC_URL") or "http://127.0.0.1:8545"
        return Web3(Web3.HTTPProvider(rpc))

    def _get_contract(self, w3):
        import os
        from web3 import Web3
        addr = os.getenv("ECOBOOST_ADDRESS") or os.getenv("VITE_ECOBOOST_ADDRESS")
        if not addr:
            raise RuntimeError("ECOBOOST_ADDRESS not set")
        abi = [
            {"inputs": [{"name": "postCid", "type": "string"}],
             "name": "getActiveBoostLevel", "outputs": [{"type": "uint8"}],
             "stateMutability": "view", "type": "function"},
            {"inputs": [{"name": "postCid", "type": "string"}],
             "name": "getBoostCount", "outputs": [{"type": "uint256"}],
             "stateMutability": "view", "type": "function"},
            {"inputs": [{"name": "postCid", "type": "string"}],
             "name": "getBoosts",
             "outputs": [{"components": [
                 {"name": "booster",   "type": "address"},
                 {"name": "level",     "type": "uint8"},
                 {"name": "amount",    "type": "uint256"},
                 {"name": "timestamp", "type": "uint64"},
             ], "type": "tuple[]"}],
             "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "totalBurned",
             "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
        ]
        return w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

    # ── Public API ──────────────────────────────────────────────

    async def get_boost_status(self, post_cid: str) -> BoostStatus:
        """
        Get the current boost status for a post CID.
        Uses Redis cache, falls back to direct contract read.
        """
        redis = self._get_redis()
        cache_key = f"boost:status:{post_cid}"
        cached = redis.get_json(cache_key)
        if cached:
            return BoostStatus(**cached)

        status = await self._fetch_boost_status_from_chain(post_cid)
        redis.set_json(cache_key, {
            "post_cid":          status.post_cid,
            "is_boosted":        status.is_boosted,
            "active_level":      status.active_level,
            "active_tier_name":  status.active_tier_name,
            "reach_multiplier":  status.reach_multiplier,
            "expires_at":        status.expires_at,
            "boost_count":       status.boost_count,
            "total_eco_burned":  status.total_eco_burned,
        }, ex=self.CACHE_TTL)
        return status

    async def get_boost_history(self, post_cid: str) -> list[BoostRecord]:
        """Return full boost history for a post."""
        try:
            w3 = self._get_web3()
            contract = self._get_contract(w3)
            raw_boosts = contract.functions.getBoosts(post_cid).call()
            now = time.time()
            records = []
            for b in raw_boosts:
                booster, level, amount, timestamp = b
                tier = BOOST_TIERS.get(level, BOOST_TIERS[1])
                duration_secs = tier["duration_hours"] * 3600
                expires_at = float(timestamp) + duration_secs
                records.append(BoostRecord(
                    booster=booster,
                    level=level,
                    tier_name=tier["name"],
                    eco_cost=amount / 10**18,
                    boosted_at=float(timestamp),
                    expires_at=expires_at,
                    is_active=now <= expires_at,
                ))
            return records
        except Exception as e:
            logger.warning("get_boost_history failed for %s: %s", post_cid, e)
            return []

    def get_feed_multiplier(self, active_level: int) -> float:
        """
        Convert active boost level to a feed score multiplier.
        Used by feed_service to rank boosted posts higher.
        """
        tier = BOOST_TIERS.get(active_level)
        if not tier:
            return 1.0
        return float(tier["reach_multiplier"])

    def invalidate_cache(self, post_cid: str) -> None:
        """Clear boost cache after a boost transaction is confirmed."""
        redis = self._get_redis()
        redis.delete(f"boost:status:{post_cid}")

    # ── Internal ────────────────────────────────────────────────

    async def _fetch_boost_status_from_chain(self, post_cid: str) -> BoostStatus:
        """Direct contract read — slow path."""
        try:
            w3 = self._get_web3()
            contract = self._get_contract(w3)

            active_level: int = contract.functions.getActiveBoostLevel(post_cid).call()
            boost_count: int = contract.functions.getBoostCount(post_cid).call()

            tier = BOOST_TIERS.get(active_level)
            is_boosted = active_level > 0
            reach_multiplier = tier["reach_multiplier"] if tier else 1
            tier_name = tier["name"] if tier else "None"

            # Estimate expires_at from most recent boost
            expires_at = None
            if is_boosted:
                raw_boosts = contract.functions.getBoosts(post_cid).call()
                if raw_boosts:
                    latest = max(raw_boosts, key=lambda b: b[3])
                    duration = BOOST_TIERS.get(latest[1], BOOST_TIERS[1])["duration_hours"] * 3600
                    expires_at = float(latest[3]) + duration

            # Total ECO burned on this post
            raw_boosts_all = contract.functions.getBoosts(post_cid).call()
            total_burned = sum(b[2] / 10**18 for b in raw_boosts_all)

            return BoostStatus(
                post_cid=post_cid,
                is_boosted=is_boosted,
                active_level=active_level,
                active_tier_name=tier_name,
                reach_multiplier=reach_multiplier,
                expires_at=expires_at,
                boost_count=boost_count,
                total_eco_burned=round(total_burned, 4),
            )

        except Exception as e:
            logger.warning("Chain read failed for boost status %s: %s", post_cid, e)
            return BoostStatus(
                post_cid=post_cid, is_boosted=False, active_level=0,
                active_tier_name="None", reach_multiplier=1,
                expires_at=None, boost_count=0, total_eco_burned=0.0,
            )


boost_service = BoostService()
