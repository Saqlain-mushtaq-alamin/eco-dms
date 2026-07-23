"""
OpenAPI Documentation Configuration
=====================================
Enriches the auto-generated FastAPI OpenAPI schema with:
  - Custom title, description, version, license
  - Tag-level descriptions (shown in Swagger UI sidebar)
  - Grouped security schemes (SIWE session cookie)
  - Custom /docs and /redoc endpoints with branding
  - Example request/response bodies for key endpoints

Import and call `configure_openapi(app)` in main.py after all routers
have been registered.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

# ─── Tag descriptions ────────────────────────────────────────────────────────
TAGS_METADATA = [
    {
        "name": "auth",
        "description": (
            "Sign-In With Ethereum (SIWE) authentication. "
            "All protected endpoints require a valid SIWE session cookie. "
            "Flow: `GET /api/siwe/nonce` → wallet signs message → `POST /api/siwe/verify`."
        ),
    },
    {
        "name": "portfolio",
        "description": (
            "Eco Portfolio — the on-chain career record for verified environmental action. "
            "Returns aggregated CO₂ offsets, eco levels, streak data, and the 52-week "
            "contribution graph for any wallet address."
        ),
    },
    {
        "name": "leaderboard",
        "description": (
            "Global and category-specific leaderboards. "
            "Ranked by total ML-verified eco actions. Updated every 60 seconds."
        ),
    },
    {
        "name": "credentials",
        "description": (
            "Soulbound NFT credential system (EcoCredential.sol). "
            "Check eligibility for 9 milestone and community credentials, "
            "view on-chain owned credentials, and trigger minting."
        ),
    },
    {
        "name": "boost",
        "description": (
            "EcoBoost token-burning reach amplification system. "
            "Three tiers: Spark (5 ECO, 3× reach, 24h), Flame (15 ECO, 10× reach, 48h), "
            "Wildfire (50 ECO, 50× reach, 7d). All ECO is permanently burned."
        ),
    },
    {
        "name": "posts",
        "description": (
            "Decentralized post management. Posts are stored on IPFS/OrbitDB — "
            "no central database. Verified posts trigger the ML fraud pipeline automatically."
        ),
    },
    {
        "name": "verification",
        "description": (
            "ML verification pipeline endpoints. Submit posts for eco-action verification, "
            "poll verification status, and retrieve signed verdicts for on-chain submission."
        ),
    },
    {
        "name": "voting",
        "description": (
            "Community voting on eco post authenticity. "
            "After ML verification opens a voting window, token holders can vote. "
            "Accurate voters earn reputation points."
        ),
    },
    {
        "name": "admin-fraud",
        "description": (
            "Admin-only fraud review dashboard API. "
            "Lists flagged and auto-blocked posts, supports approve/reject/escalate decisions, "
            "and exposes pipeline statistics. Requires admin wallet address."
        ),
    },
    {
        "name": "users",
        "description": "User profile management — username, bio, avatar IPFS CID.",
    },
    {
        "name": "notifications",
        "description": "Decentralized notification system for verification results and governance events.",
    },
]

# ─── Custom schema generator ─────────────────────────────────────────────────
def custom_openapi(app: FastAPI):
    """Generate the custom OpenAPI schema (cached on app.openapi_schema)."""
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title="EcoDMS — Decentralized Eco Social Platform API",
        version="2.0.0",
        summary="Production API for EcoDMS — a decentralized, ML-verified environmental action platform",
        description="""
## Overview

EcoDMS is a **decentralized social platform** where users document real environmental actions.
Each post is verified by an ML pipeline (pHash duplicate detection, EXIF analysis, AI image detection,
temporal burst checks) and rewarded with ECO tokens via `DynamicVerification.sol`.

## Authentication

All protected endpoints require a **Sign-In With Ethereum (SIWE)** session.

```
1. GET  /api/siwe/nonce          → get a one-time nonce
2. Wallet signs the SIWE message
3. POST /api/siwe/verify         → exchange signature for session cookie
4. Use session cookie on all subsequent requests
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **ECO Token** | ERC-20 reward token minted on verified eco posts |
| **Eco Portfolio** | On-chain career record: CO₂ offsets, streak, level, credentials |
| **EcoBoost** | Burn ECO to amplify post reach (3× → 50×) |
| **EcoCredential** | Soulbound NFT issued for milestones (streaks, CO₂ targets) |
| **EcoDAO** | Quadratic-voting governance (Level 10+ users) |
| **Fraud Pipeline** | 5-layer: duplicate → EXIF → temporal → AI detection → impact scoring |

## Rate Limits

- Unauthenticated: 10 req/min
- Authenticated: 120 req/min  
- Admin endpoints: 60 req/min

## Networks

Contracts deployed on **Polygon** (primary) and **Base** (secondary).
Local development uses Hardhat localhost (chainId 31337).
        """.strip(),
        routes=app.routes,
        tags=TAGS_METADATA,
    )

    # ── Security scheme ──────────────────────────────────────────────
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "SIWESession": {
            "type": "apiKey",
            "in": "cookie",
            "name": "session",
            "description": "SIWE session cookie obtained from POST /api/siwe/verify",
        }
    }

    # Apply session security to all operations (can be overridden per-route)
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            if isinstance(operation, dict) and "tags" in operation:
                tags = operation.get("tags", [])
                if "auth" not in tags:
                    operation.setdefault("security", [{"SIWESession": []}])

    # ── External docs ────────────────────────────────────────────────
    schema["externalDocs"] = {
        "description": "EcoDMS Planning Documents",
        "url": "https://github.com/ecodms/eco-dms/tree/main/planning",
    }

    # ── Contact & License ────────────────────────────────────────────
    schema["info"]["contact"] = {
        "name": "EcoDMS Team",
        "url": "https://ecodms.app",
        "email": "dev@ecodms.app",
    }
    schema["info"]["license"] = {
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    }

    app.openapi_schema = schema
    return schema


def configure_openapi(app: FastAPI) -> None:
    """
    Wire custom OpenAPI generator into the FastAPI app.
    Call this after all routers are registered in main.py.
    """
    app.openapi = lambda: custom_openapi(app)  # type: ignore[method-assign]

    # Override docs UI titles
    app.title = "EcoDMS API"
    app.description = "Decentralized Eco Social Platform"
    app.version = "2.0.0"
