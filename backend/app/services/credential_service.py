"""
Credential Service
==================
Backend service for EcoCredential.sol (soulbound NFT credentials).

Responsibilities:
  - Check credential eligibility for a wallet (based on portfolio data)
  - Prepare credential metadata and pin it to IPFS
  - Trigger on-chain minting via the owner key (backend-signed)
  - Fetch owned credentials from contract state
  - Cache credential metadata for frontend display

Credential types (mirrors EcoCredential.sol):
  milestone  → 20 ECO burn  (streak, action count, CO₂ milestones)
  community  → 10 ECO burn  (voting contribution, cleanups)
  partner    →  5 ECO burn  (industry partner-issued)
  annual     → 30 ECO burn  (year-end achievement)
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# Credential definitions — checked against live portfolio data
CREDENTIAL_DEFINITIONS: list[dict] = [
    # Milestone credentials
    {
        "id": "first_action",
        "title": "First Verified Eco Action",
        "type": "milestone",
        "description": "Completed your first ML-verified eco action on EcoDMS.",
        "check": lambda p: p.get("total_verified_actions", 0) >= 1,
        "rarity": "common",
    },
    {
        "id": "streak_30",
        "title": "30-Day Eco Streak",
        "type": "milestone",
        "description": "Maintained an unbroken streak of eco actions for 30 days.",
        "check": lambda p: p.get("longest_streak_days", 0) >= 30,
        "rarity": "rare",
    },
    {
        "id": "streak_100",
        "title": "100-Day Eco Streak",
        "type": "milestone",
        "description": "100 consecutive days of verified eco action — extraordinary commitment.",
        "check": lambda p: p.get("longest_streak_days", 0) >= 100,
        "rarity": "epic",
    },
    {
        "id": "actions_100",
        "title": "100 Verified Actions",
        "type": "milestone",
        "description": "Reached 100 ML-verified eco actions on EcoDMS.",
        "check": lambda p: p.get("total_verified_actions", 0) >= 100,
        "rarity": "rare",
    },
    {
        "id": "actions_500",
        "title": "500 Verified Actions",
        "type": "milestone",
        "description": "500 verified eco actions — a true Earth Guardian.",
        "check": lambda p: p.get("total_verified_actions", 0) >= 500,
        "rarity": "epic",
    },
    {
        "id": "co2_1t",
        "title": "1 Tonne CO₂ Offset",
        "type": "milestone",
        "description": "Offset over 1,000 kg of CO₂ equivalent through verified eco actions.",
        "check": lambda p: p.get("co2_offset_kg", 0) >= 1000,
        "rarity": "rare",
    },
    {
        "id": "co2_10t",
        "title": "10 Tonnes CO₂ Offset",
        "type": "milestone",
        "description": "Offset over 10,000 kg of CO₂ — equivalent to grounding a transatlantic flight.",
        "check": lambda p: p.get("co2_offset_kg", 0) >= 10000,
        "rarity": "legendary",
    },
    # Community credentials
    {
        "id": "top_voter",
        "title": "Community Validator",
        "type": "community",
        "description": "Cast 50+ community votes with high accuracy.",
        "check": lambda p: p.get("votes_cast", 0) >= 50 and p.get("verification_accuracy", 0) >= 0.8,
        "rarity": "rare",
    },
    {
        "id": "dao_member",
        "title": "DAO Member",
        "type": "community",
        "description": "Reached Level 10 (Earth Guardian) and earned DAO governance rights.",
        "check": lambda p: p.get("eco_level", 1) >= 10,
        "rarity": "epic",
    },
]

RARITY_COLORS = {
    "common":    "#6b7280",
    "rare":      "#3b82f6",
    "epic":      "#8b5cf6",
    "legendary": "#f59e0b",
}


@dataclass
class CredentialEligibility:
    credential_id: str
    title: str
    credential_type: str
    description: str
    rarity: str
    rarity_color: str
    is_eligible: bool
    already_minted: bool
    eco_cost: int         # ECO to burn (from contract mintCosts)
    metadata_preview: dict


@dataclass
class OwnedCredential:
    token_id: int
    title: str
    credential_type: str
    rarity: str
    rarity_color: str
    earned_at: float
    ipfs_uri: str
    description: str


class CredentialService:
    """
    Service for EcoCredential.sol (soulbound NFT) credential management.
    """

    CREDENTIAL_COSTS = {"milestone": 20, "community": 10, "partner": 5, "annual": 30}
    CACHE_TTL = 120  # 2 minutes

    def _get_redis(self):
        from .redis_service import redis_service
        return redis_service

    def _get_contract(self):
        import os
        from web3 import Web3
        rpc = os.getenv("RPC_URL") or "http://127.0.0.1:8545"
        addr = os.getenv("ECOCREDENTIAL_ADDRESS") or os.getenv("VITE_ECOCREDENTIAL_ADDRESS")
        if not addr:
            raise RuntimeError("ECOCREDENTIAL_ADDRESS not set")
        abi = [
            {"inputs": [{"name": "owner", "type": "address"}],
             "name": "getCredentialsByOwner", "outputs": [{"type": "uint256[]"}],
             "stateMutability": "view", "type": "function"},
            {"inputs": [{"name": "tokenId", "type": "uint256"}],
             "name": "getCredential",
             "outputs": [{"components": [
                 {"name": "credentialType", "type": "string"},
                 {"name": "title",          "type": "string"},
                 {"name": "metadataCid",    "type": "string"},
                 {"name": "earnedAt",       "type": "uint256"},
                 {"name": "earner",         "type": "address"},
             ], "type": "tuple"}],
             "stateMutability": "view", "type": "function"},
            {"inputs": [{"name": "earner", "type": "address"}, {"name": "title", "type": "string"}],
             "name": "hasCredential", "outputs": [{"type": "bool"}],
             "stateMutability": "view", "type": "function"},
        ]
        w3 = Web3(Web3.HTTPProvider(rpc))
        return w3, w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

    # ── Public API ──────────────────────────────────────────────

    async def get_eligibility(self, wallet: str, portfolio: dict) -> list[CredentialEligibility]:
        """
        Check which credentials a wallet is eligible for.

        Args:
            wallet: Wallet address (checksummed or lowercase)
            portfolio: Portfolio dict from portfolio_service

        Returns:
            List of CredentialEligibility (eligible and ineligible)
        """
        results = []
        for defn in CREDENTIAL_DEFINITIONS:
            is_eligible = False
            already_minted = False

            try:
                is_eligible = bool(defn["check"](portfolio))
            except Exception:
                pass

            # Check on-chain if already minted (cached)
            if is_eligible:
                already_minted = await self._check_already_minted(wallet, defn["title"])

            cost = self.CREDENTIAL_COSTS.get(defn["type"], 20)
            results.append(CredentialEligibility(
                credential_id=defn["id"],
                title=defn["title"],
                credential_type=defn["type"],
                description=defn["description"],
                rarity=defn["rarity"],
                rarity_color=RARITY_COLORS.get(defn["rarity"], "#6b7280"),
                is_eligible=is_eligible,
                already_minted=already_minted,
                eco_cost=cost,
                metadata_preview={
                    "name": defn["title"],
                    "description": defn["description"],
                    "attributes": [
                        {"trait_type": "Type", "value": defn["type"].capitalize()},
                        {"trait_type": "Rarity", "value": defn["rarity"].capitalize()},
                        {"trait_type": "Platform", "value": "EcoDMS"},
                    ],
                },
            ))
        return results

    async def get_owned_credentials(self, wallet: str) -> list[OwnedCredential]:
        """Fetch all soulbound credentials owned by a wallet from chain."""
        redis = self._get_redis()
        cache_key = f"credentials:owned:{wallet.lower()}"
        cached = redis.get_json(cache_key)
        if cached:
            return [OwnedCredential(**c) for c in cached]

        owned = await self._fetch_from_chain(wallet)
        redis.set_json(cache_key, [
            {"token_id": c.token_id, "title": c.title, "credential_type": c.credential_type,
             "rarity": c.rarity, "rarity_color": c.rarity_color, "earned_at": c.earned_at,
             "ipfs_uri": c.ipfs_uri, "description": c.description}
            for c in owned
        ], ex=self.CACHE_TTL)
        return owned

    def invalidate_cache(self, wallet: str) -> None:
        redis = self._get_redis()
        redis.delete(f"credentials:owned:{wallet.lower()}")

    # ── Internal ────────────────────────────────────────────────

    async def _check_already_minted(self, wallet: str, title: str) -> bool:
        redis = self._get_redis()
        cache_key = f"credentials:has:{wallet.lower()}:{title}"
        cached = redis.client.get(cache_key)
        if cached is not None:
            return cached == b"1"
        try:
            from web3 import Web3
            w3, contract = self._get_contract()
            result: bool = contract.functions.hasCredential(
                Web3.to_checksum_address(wallet), title
            ).call()
            redis.client.set(cache_key, b"1" if result else b"0", ex=300)
            return result
        except Exception as e:
            logger.debug("hasCredential check failed: %s", e)
            return False

    async def _fetch_from_chain(self, wallet: str) -> list[OwnedCredential]:
        try:
            from web3 import Web3
            w3, contract = self._get_contract()
            token_ids: list[int] = contract.functions.getCredentialsByOwner(
                Web3.to_checksum_address(wallet)
            ).call()

            owned = []
            for tid in token_ids:
                cred = contract.functions.getCredential(tid).call()
                cred_type, title, metadata_cid, earned_at, earner = cred

                # Look up rarity from local definitions
                defn = next((d for d in CREDENTIAL_DEFINITIONS if d["title"] == title), None)
                rarity = defn["rarity"] if defn else "common"

                owned.append(OwnedCredential(
                    token_id=tid,
                    title=title,
                    credential_type=cred_type,
                    rarity=rarity,
                    rarity_color=RARITY_COLORS.get(rarity, "#6b7280"),
                    earned_at=float(earned_at),
                    ipfs_uri=f"ipfs://{metadata_cid}",
                    description=defn["description"] if defn else "",
                ))
            return owned
        except Exception as e:
            logger.warning("Credential chain fetch failed for %s: %s", wallet, e)
            return []


credential_service = CredentialService()
