"""
User routes for decentralized profile management.
No SQLite - uses IPFS storage via user_service.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from .auth_routes import get_current_user
from .models import UserProfile, ProfileUpdateRequest
from .services.user_service import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_my_profile(wallet_address: str = Depends(get_current_user)):
    """
    Get current user's profile from IPFS.
    
    Requires authentication.
    
    Returns:
        UserProfile with all user data
    """
    profile = await user_service.get_profile(wallet_address)
    
    if not profile:
        # Create profile if doesn't exist
        profile, _ = await user_service.get_or_create_profile(wallet_address)
    
    return profile


@router.put("/me", response_model=dict)
async def update_my_profile(
    update_data: ProfileUpdateRequest,
    wallet_address: str = Depends(get_current_user)
):
    """
    Update current user's profile.
    
    Args:
        update_data: Fields to update (username, bio, avatar_cid)
    
    Returns:
        Success message with new profile CID
    """
    new_cid = await user_service.update_profile(
        wallet_address,
        username=update_data.username,
        bio=update_data.bio,
        avatar_cid=update_data.avatar_cid
    )
    
    if not new_cid:
        raise HTTPException(status_code=500, detail="Failed to update profile")
    
    return {
        "success": True,
        "profile_cid": new_cid,
        "message": "Profile updated successfully"
    }


@router.get("/{wallet_address}", response_model=UserProfile)
async def get_user_profile(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get any user's profile by wallet address.
    
    Args:
        wallet_address: Target user's wallet address
    
    Returns:
        UserProfile data
    """
    profile = await user_service.get_profile(wallet_address.lower())
    
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    return profile


@router.post("/follow/{wallet_address}", response_model=dict)
async def follow_user(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Follow another user.
    
    Args:
        wallet_address: User to follow
    
    Returns:
        Success message
    """
    # Can't follow yourself
    if wallet_address.lower() == current_user.lower():
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    success = await user_service.follow_user(current_user, wallet_address.lower())
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to follow user")
    
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
    
    Args:
        wallet_address: User to unfollow
    
    Returns:
        Success message
    """
    success = await user_service.unfollow_user(current_user, wallet_address.lower())
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to unfollow user")
    
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
    
    Args:
        wallet_address: Target user's wallet
    
    Returns:
        List of follower wallet addresses
    """
    followers = await user_service.get_followers(wallet_address.lower())
    
    return {
        "wallet_address": wallet_address,
        "followers": followers,
        "count": len(followers)
    }


@router.get("/following/{wallet_address}", response_model=dict)
async def get_following(
    wallet_address: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get list of users that this user follows.
    
    Args:
        wallet_address: Target user's wallet
    
    Returns:
        List of wallet addresses being followed
    """
    following = await user_service.get_following(wallet_address.lower())
    
    return {
        "wallet_address": wallet_address,
        "following": following,
        "count": len(following)
    }