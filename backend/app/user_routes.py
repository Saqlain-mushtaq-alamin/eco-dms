"""
User routes for decentralized profile management.
No SQLite - uses IPFS storage via user_service.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
import json
import logging

from .auth_routes import get_current_user
from .models import UserProfile, ProfileUpdateRequest
from .services.user_service import user_service
from .services.user_search_service import user_search_service
from .services.redis_service import redis_service  # add Redis cache

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)
CACHE_TTL = 60  # bump to 60s for fewer backend hits

def _serialize_profile(profile: dict) -> dict:
    """Convert datetime objects to ISO strings for JSON serialization."""
    serialized = {}
    for key, value in profile.items():
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()  # Convert to string
        elif isinstance(value, (list, tuple)):
            serialized[key] = [v.isoformat() if isinstance(v, datetime) else v for v in value]
        else:
            serialized[key] = value
    return serialized

@router.get("/me", response_model=UserProfile)
async def get_my_profile(wallet_address: str = Depends(get_current_user)):
    """
    Get current user's profile from IPFS.
    """
    cache_key = f"profile:{wallet_address.lower()}"
    cached = redis_service.get_json(cache_key)
    if cached:
        return cached

    # IPFS operations can be slow—ensure user_service uses async non-blocking client
    profile = await user_service.get_profile(wallet_address)
    if not profile:
        profile, _ = await user_service.get_or_create_profile(wallet_address)

    redis_service.set_json(cache_key, profile, ex=CACHE_TTL)
    return profile

@router.put("/me", response_model=dict)
async def update_my_profile(
    update_data: ProfileUpdateRequest,
    wallet_address: str = Depends(get_current_user)
):
    """
    Update current user's profile.
    """
    logger.debug("PUT /me called for %s", wallet_address)
    if not wallet_address:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    new_cid = await user_service.update_profile(
        wallet_address,
        username=update_data.username,
        bio=update_data.bio,
        avatar_cid=update_data.avatar_cid,
        cover_photo_cid=update_data.cover_photo_cid,
        date_of_birth=update_data.date_of_birth,
        location=update_data.location,
        profession=update_data.profession
    )
    if not new_cid:
        raise HTTPException(status_code=500, detail="Failed to update profile")

    # bust profile cache and users list cache
    redis_service.delete(f"profile:{wallet_address.lower()}")
    redis_service.delete("users:all")

    return {
        "success": True,
        "profile_cid": new_cid,
        "message": "Profile updated successfully"
    }

@router.get("/all", response_model=dict)
async def get_all_users(
    current_user: str = Depends(get_current_user)
):
    """
    Get list of all registered users with their profiles.
    """
    cache_key = "users:all"
    cached = redis_service.get_json(cache_key)
    if cached:
        return {"users": cached, "count": len(cached)}

    users = await user_service.get_all_users()
    redis_service.set_json(cache_key, users, ex=CACHE_TTL)
    return {"users": users, "count": len(users)}


@router.get("/search", response_model=dict)
async def search_users(
    q: str,
    limit: int = 20,
    current_user: str = Depends(get_current_user)
):
    """
    Search users by username or wallet address.
    """
    query = q.strip()
    if not query:
        return {"users": [], "count": 0, "query": q}

    safe_limit = max(1, min(limit, 50))
    users = await user_search_service.search_users(query, current_user, safe_limit)
    return {"users": users, "count": len(users), "query": q}

@router.get("/{wallet_address}", response_model=UserProfile)
async def get_user_profile(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get any user's profile by wallet address.
    """
    key = f"profile:{wallet_address.lower()}"
    cached = redis_service.get_json(key)
    if cached:
        return cached

    profile = await user_service.get_profile(wallet_address.lower())
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    redis_service.set_json(key, profile, ex=CACHE_TTL)
    return profile

@router.post("/follow/{wallet_address}", response_model=dict)
async def follow_user(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Follow another user.
    """
    if wallet_address.lower() == current_user.lower():
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    success = await user_service.follow_user(current_user, wallet_address.lower())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to follow user")

    # bust caches related to following/followers
    redis_service.delete(f"followers:{wallet_address.lower()}")
    redis_service.delete(f"following:{current_user.lower()}")

    return {
        "success": True,
        "message": f"Now following {wallet_address}"
    }

@router.delete("/follow/{wallet_address}", response_model=dict)
async def unfollow_user(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Unfollow a user.
    """
    success = await user_service.unfollow_user(current_user, wallet_address.lower())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to unfollow user")

    # bust caches related to following/followers
    redis_service.delete(f"followers:{wallet_address.lower()}")
    redis_service.delete(f"following:{current_user.lower()}")

    return {
        "success": True,
        "message": f"Unfollowed {wallet_address}"
    }

@router.get("/followers/{wallet_address}", response_model=dict)
async def get_followers(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get list of followers for a user.
    """
    key = f"followers:{wallet_address.lower()}"
    cached = redis_service.get_json(key)
    if cached:
        return {"wallet_address": wallet_address, "followers": cached, "count": len(cached)}

    followers = await user_service.get_followers(wallet_address.lower())
    redis_service.set_json(key, followers, ex=CACHE_TTL)
    return {"wallet_address": wallet_address, "followers": followers, "count": len(followers)}

@router.get("/following/{wallet_address}", response_model=dict)
async def get_following(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get list of users that this user follows.
    """
    key = f"following:{wallet_address.lower()}"
    cached = redis_service.get_json(key)
    if cached:
        return {"wallet_address": wallet_address, "following": cached, "count": len(cached)}

    following = await user_service.get_following(wallet_address.lower())
    redis_service.set_json(key, following, ex=CACHE_TTL)
    return {"wallet_address": wallet_address, "following": following, "count": len(following)}

@router.get("/check-follow/{wallet_address}", response_model=dict)
async def check_follow_status(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Check if current user follows the specified wallet address.
    """
    following = await user_service.get_following(current_user.lower())
    is_following = wallet_address.lower() in [addr.lower() for addr in following]
    
    return {
        "wallet_address": wallet_address,
        "is_following": is_following
    }