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

from .auth_routes import get_current_user
from .services.portfolio_service import portfolio_service

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])
leaderboard_router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])
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
