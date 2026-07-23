"""
Portfolio API Routes — the Eco Portfolio public API.

Implements all endpoints described in planning/02_ECO_PORTFOLIO_SYSTEM.md:
  GET  /api/portfolio/{wallet}            Public portfolio data
  GET  /api/portfolio/{wallet}/graph      52-week action graph
  GET  /api/portfolio/{wallet}/stats      Summary stats
  GET  /api/portfolio/{wallet}/credentials Earned credentials
  GET  /api/portfolio/{wallet}/embed      Embeddable widget data
  POST /api/portfolio/{wallet}/refresh    Force-refresh cached portfolio

  GET  /api/leaderboard/global            Top eco contributors globally
  GET  /api/leaderboard/monthly           Top contributors this month
  GET  /api/leaderboard/category/{cat}    Category-specific leaderboard
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from .auth_routes import get_current_user, require_authenticated
from .services.portfolio_service import portfolio_service

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])
leaderboard_router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])
credentials_router = APIRouter(prefix="/api/credentials", tags=["credentials"])
boost_router = APIRouter(prefix="/api/boost", tags=["boost"])
logger = logging.getLogger(__name__)


# ─── Portfolio Endpoints ────────────────────────────────────────────────────

@router.get("/{wallet}", response_model=dict)
async def get_portfolio(
    wallet: str,
    _current_user: str = Depends(get_current_user),
):
    """
    Get the full Eco Portfolio for any wallet address.

    Returns verified action counts, CO2 estimates, eco level,
    contribution graph, credentials, and voting reputation.
    Publicly accessible (but requires auth to prevent scraping).
    """
    try:
        portfolio = await portfolio_service.get_portfolio(wallet.lower())
        return portfolio
    except Exception as e:
        logger.error("Portfolio fetch error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load portfolio")


@router.get("/{wallet}/graph", response_model=dict)
async def get_action_graph(
    wallet: str,
    _current_user: str = Depends(get_current_user),
):
    """
    Get the 52-week contribution graph for a wallet.

    Returns week-by-week daily action counts, styled like GitHub's
    contribution graph but for eco-actions.
    """
    try:
        graph = await portfolio_service.get_action_graph(wallet.lower())
        return graph
    except Exception as e:
        logger.error("Graph fetch error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load action graph")


@router.get("/{wallet}/stats", response_model=dict)
async def get_portfolio_stats(
    wallet: str,
    _current_user: str = Depends(get_current_user),
):
    """
    Get summary statistics for a wallet (lightweight endpoint for widgets).

    Returns: total_verified_actions, co2_offset_kg, eco_level, eco_title,
             current_streak_days, verification_accuracy
    """
    try:
        portfolio = await portfolio_service.get_portfolio(wallet.lower())
        return {
            "wallet":                wallet.lower(),
            "total_verified_actions": portfolio.get("total_verified_actions", 0),
            "co2_offset_kg":         portfolio.get("co2_offset_kg", 0.0),
            "eco_level":             portfolio.get("eco_level", 1),
            "eco_title":             portfolio.get("eco_title", "Eco Seedling"),
            "current_streak_days":   portfolio.get("current_streak_days", 0),
            "longest_streak_days":   portfolio.get("longest_streak_days", 0),
            "verification_accuracy": portfolio.get("verification_accuracy", 0.0),
            "portfolio_url":         portfolio.get("portfolio_url"),
        }
    except Exception as e:
        logger.error("Stats fetch error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load stats")


@router.get("/{wallet}/credentials", response_model=dict)
async def get_credentials(
    wallet: str,
    _current_user: str = Depends(get_current_user),
):
    """
    Get earned and claimable credentials for a wallet.

    Returns both already-minted blockchain credentials and
    credentials the user qualifies for but hasn't claimed yet.
    """
    try:
        portfolio = await portfolio_service.get_portfolio(wallet.lower())
        return {
            "wallet":                wallet.lower(),
            "credentials":           portfolio.get("credentials", []),
            "claimable_credentials": portfolio.get("claimable_credentials", []),
        }
    except Exception as e:
        logger.error("Credentials fetch error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load credentials")


@router.get("/{wallet}/embed", response_model=dict)
async def get_embed_data(
    wallet: str,
):
    """
    Get embeddable widget data for a wallet (no auth required — public embed).

    This endpoint is used for the <iframe> embed widget that users can put
    on personal websites, LinkedIn, and resumes.
    """
    try:
        portfolio = await portfolio_service.get_portfolio(wallet.lower())
        # Return only the subset needed for the embed widget
        return {
            "wallet":                wallet.lower(),
            "username":              portfolio.get("username"),
            "total_verified_actions": portfolio.get("total_verified_actions", 0),
            "co2_offset_kg":         portfolio.get("co2_offset_kg", 0.0),
            "eco_level":             portfolio.get("eco_level", 1),
            "eco_title":             portfolio.get("eco_title", "Eco Seedling"),
            "current_streak_days":   portfolio.get("current_streak_days", 0),
            "portfolio_url":         portfolio.get("portfolio_url"),
            # Mini graph (last 12 months only)
            "monthly_actions":       (portfolio.get("monthly_actions") or [])[-6:],
        }
    except Exception as e:
        logger.error("Embed data error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load embed data")


@router.post("/{wallet}/refresh", response_model=dict)
async def refresh_portfolio(
    wallet: str,
    current_user: str = Depends(get_current_user),
):
    """
    Force-refresh a wallet's portfolio cache.

    Users can only refresh their own portfolio. Admins can refresh any.
    Useful after a new verified post or credential claim.
    """
    if wallet.lower() != current_user.lower():
        raise HTTPException(
            status_code=403,
            detail="Can only refresh your own portfolio"
        )

    try:
        await portfolio_service.invalidate(wallet.lower())
        portfolio = await portfolio_service.get_portfolio(wallet.lower(), force_refresh=True)
        return {
            "success": True,
            "message": "Portfolio refreshed successfully",
            "total_verified_actions": portfolio.get("total_verified_actions", 0),
        }
    except Exception as e:
        logger.error("Portfolio refresh error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to refresh portfolio")


# ─── Leaderboard Endpoints ──────────────────────────────────────────────────

@leaderboard_router.get("/global", response_model=dict)
async def get_global_leaderboard(
    limit: int = Query(default=50, ge=1, le=100),
    _current_user: str = Depends(get_current_user),
):
    """
    Get the global top eco contributors leaderboard.

    Ranked by total verified eco-actions. Includes CO2 offset,
    eco level, and streak data for each user.
    """
    try:
        entries = await portfolio_service.get_leaderboard("global", limit)
        return {
            "scope": "global",
            "entries": entries,
            "count": len(entries),
        }
    except Exception as e:
        logger.error("Global leaderboard error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load leaderboard")


@leaderboard_router.get("/monthly", response_model=dict)
async def get_monthly_leaderboard(
    limit: int = Query(default=50, ge=1, le=100),
    _current_user: str = Depends(get_current_user),
):
    """
    Get the top eco contributors for the current month.
    """
    try:
        entries = await portfolio_service.get_leaderboard("monthly", limit)
        return {
            "scope": "monthly",
            "entries": entries,
            "count": len(entries),
        }
    except Exception as e:
        logger.error("Monthly leaderboard error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load leaderboard")


@leaderboard_router.get("/category/{category}", response_model=dict)
async def get_category_leaderboard(
    category: str,
    limit: int = Query(default=50, ge=1, le=100),
    _current_user: str = Depends(get_current_user),
):
    """
    Get the leaderboard for a specific eco-action category.

    Valid categories: transport, nature, waste, energy, water
    """
    valid_categories = {"transport", "nature", "waste", "energy", "water"}
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(sorted(valid_categories))}"
        )

    try:
        entries = await portfolio_service.get_leaderboard(f"category:{category}", limit)
        return {
            "scope": f"category:{category}",
            "category": category,
            "entries": entries,
            "count": len(entries),
        }
    except Exception as e:
        logger.error("Category leaderboard error for %s: %s", category, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load leaderboard")


# ─── Credential Endpoints ────────────────────────────────────────────────────

@credentials_router.get("/eligibility", response_model=list)
async def get_credential_eligibility(current_user=Depends(require_authenticated)):
    """
    Return credential eligibility for the authenticated user.
    Checks all 9 milestone/community definitions against their portfolio.
    """
    wallet = current_user.get("wallet") or ""
    if not wallet:
        raise HTTPException(status_code=401, detail="No wallet in session")
    try:
        from .services.credential_service import credential_service
        portfolio = await portfolio_service.get_portfolio(wallet.lower())
        items = await credential_service.get_eligibility(wallet, portfolio)
        return [
            {
                "credential_id":  item.credential_id,
                "title":          item.title,
                "credential_type": item.credential_type,
                "rarity":         item.rarity,
                "rarity_color":   item.rarity_color,
                "description":    item.description,
                "is_eligible":    item.is_eligible,
                "already_minted": item.already_minted,
                "eco_cost":       item.eco_cost,
                "metadata_preview": item.metadata_preview,
            }
            for item in items
        ]
    except Exception as e:
        logger.error("Credential eligibility error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load credential eligibility")


@credentials_router.get("/owned/{wallet}", response_model=list)
async def get_owned_credentials(wallet: str, current_user=Depends(require_authenticated)):
    """Fetch all on-chain soulbound credentials owned by any wallet."""
    try:
        from .services.credential_service import credential_service
        owned = await credential_service.get_owned_credentials(wallet.lower())
        return [
            {
                "token_id":        c.token_id,
                "title":           c.title,
                "credential_type": c.credential_type,
                "rarity":          c.rarity,
                "rarity_color":    c.rarity_color,
                "earned_at":       c.earned_at,
                "ipfs_uri":        c.ipfs_uri,
                "description":     c.description,
            }
            for c in owned
        ]
    except Exception as e:
        logger.error("Owned credentials error for %s: %s", wallet, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load credentials")


# ─── Boost Endpoints ─────────────────────────────────────────────────────────

@boost_router.get("/status/{post_cid}", response_model=dict)
async def get_boost_status(post_cid: str, current_user=Depends(require_authenticated)):
    """Get current boost level and expiry for a post CID."""
    try:
        from .services.boost_service import boost_service
        status = await boost_service.get_boost_status(post_cid)
        return {
            "post_cid":         status.post_cid,
            "is_boosted":       status.is_boosted,
            "active_level":     status.active_level,
            "active_tier_name": status.active_tier_name,
            "reach_multiplier": status.reach_multiplier,
            "expires_at":       status.expires_at,
            "boost_count":      status.boost_count,
            "total_eco_burned": status.total_eco_burned,
        }
    except Exception as e:
        logger.error("Boost status error for %s: %s", post_cid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load boost status")


@boost_router.get("/history/{post_cid}", response_model=list)
async def get_boost_history(post_cid: str, current_user=Depends(require_authenticated)):
    """Get full boost event history for a post CID."""
    try:
        from .services.boost_service import boost_service
        records = await boost_service.get_boost_history(post_cid)
        return [
            {
                "booster":    r.booster,
                "level":      r.level,
                "tier_name":  r.tier_name,
                "eco_cost":   r.eco_cost,
                "boosted_at": r.boosted_at,
                "expires_at": r.expires_at,
                "is_active":  r.is_active,
            }
            for r in records
        ]
    except Exception as e:
        logger.error("Boost history error for %s: %s", post_cid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load boost history")


@boost_router.post("/invalidate/{post_cid}", response_model=dict)
async def invalidate_boost_cache(post_cid: str, current_user=Depends(require_authenticated)):
    """Clear boost cache after a confirmed on-chain boost transaction."""
    try:
        from .services.boost_service import boost_service
        boost_service.invalidate_cache(post_cid)
        return {"success": True, "post_cid": post_cid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
