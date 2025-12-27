from fastapi import APIRouter, Depends, HTTPException, Header
from datetime import datetime
from typing import Dict, List
from ..models import PostCreate, CommentCreate, LikeCreate
from ..auth_routes import get_current_user
# Use posts IPFS service for pin/get
from backend.app.posts_manage.ipfs_post_service import ipfs_service
# Use Ceramic/IDX for decentralized CID indexing
from backend.app.services.ceramic_service import ceramic_service
# Use social service for likes and comments
from backend.app.services.social_service import social_service

router = APIRouter(prefix="/api/posts", tags=["posts"])

@router.post("", response_model=Dict)
async def create_post(
    payload: PostCreate,
    authorization: str | None = Header(default=None),
):
    wallet_address = await get_current_user(authorization)
    if wallet_address.lower() != payload.author_wallet.lower():
        raise HTTPException(status_code=403, detail="Author wallet must match authenticated user")
    try:
        cid = await ipfs_service.pin_json({
            "type": "post",
            "version": 1,
            "author_wallet": wallet_address.lower(),
            "content": payload.content,
            "media_cids": payload.media_cids or [],
            "tags": payload.tags or [],
            "created_at": datetime.utcnow().isoformat(),
        })

        ok = await ceramic_service.append_author_post(wallet_address.lower(), cid)
        if not ok:
            # We still return success for pinning; client can retry index update
            return {"success": True, "cid": cid, "indexed": False}

        return {"success": True, "cid": cid, "indexed": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{wallet_address}", response_model=Dict)
async def list_author_posts(
    wallet_address: str,
    authorization: str | None = Header(default=None),
):
    current_user = await get_current_user(authorization)
    """
    List posts for an author via Ceramic/IDX index; fetch content from IPFS.
    """
    try:
        cids: List[str] = await ceramic_service.get_author_posts(wallet_address.lower())
    except Exception:
        cids = []

    posts: List[dict] = []
    for cid in cids:
        try:
            post = await ipfs_service.get_json(cid)
            if post:
                post["cid"] = cid
                # Add social metrics
                post["likes_count"] = await social_service.get_likes_count(cid)
                post["comments_count"] = await social_service.get_comments_count(cid)
                post["liked_by_user"] = await social_service.has_user_liked(cid, current_user)
                posts.append(post)
        except Exception:
            continue

    return {"author_wallet": wallet_address.lower(), "count": len(posts), "posts": posts}

@router.post("/inference", response_model=Dict)
async def inference_stub(
    authorization: str | None = Header(default=None),
):
    wallet_address = await get_current_user(authorization)
    return {"eco": None}


# ==================== LIKES ====================

@router.post("/{post_cid}/like", response_model=Dict)
async def like_post(
    post_cid: str,
    authorization: str | None = Header(default=None),
):
    """Add a like to a post"""
    wallet_address = await get_current_user(authorization)
    
    try:
        success = await social_service.add_like(post_cid, wallet_address)
        if success:
            likes_count = await social_service.get_likes_count(post_cid)
            return {
                "success": True,
                "post_cid": post_cid,
                "likes_count": likes_count
            }
        raise HTTPException(status_code=500, detail="Failed to add like")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{post_cid}/like", response_model=Dict)
async def unlike_post(
    post_cid: str,
    authorization: str | None = Header(default=None),
):
    """Remove a like from a post"""
    wallet_address = await get_current_user(authorization)
    
    try:
        success = await social_service.remove_like(post_cid, wallet_address)
        if success:
            likes_count = await social_service.get_likes_count(post_cid)
            return {
                "success": True,
                "post_cid": post_cid,
                "likes_count": likes_count
            }
        raise HTTPException(status_code=500, detail="Failed to remove like")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{post_cid}/likes", response_model=Dict)
async def get_post_likes(
    post_cid: str,
    authorization: str | None = Header(default=None),
):
    """Get all likes for a post"""
    await get_current_user(authorization)  # Verify authentication
    
    try:
        likes = await social_service.get_post_likes(post_cid)
        return {
            "post_cid": post_cid,
            "likes": likes,
            "count": len(likes)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== COMMENTS ====================

@router.post("/{post_cid}/comments", response_model=Dict)
async def create_comment(
    post_cid: str,
    payload: CommentCreate,
    authorization: str | None = Header(default=None),
):
    """Add a comment to a post"""
    wallet_address = await get_current_user(authorization)
    
    if wallet_address.lower() != payload.author_wallet.lower():
        raise HTTPException(status_code=403, detail="Author wallet must match authenticated user")
    
    try:
        comment_cid = await social_service.add_comment(
            post_cid,
            wallet_address,
            payload.content
        )
        
        if comment_cid:
            comments_count = await social_service.get_comments_count(post_cid)
            return {
                "success": True,
                "comment_cid": comment_cid,
                "post_cid": post_cid,
                "comments_count": comments_count
            }
        
        raise HTTPException(status_code=500, detail="Failed to create comment")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{post_cid}/comments", response_model=Dict)
async def get_post_comments(
    post_cid: str,
    authorization: str | None = Header(default=None),
):
    """Get all comments for a post"""
    await get_current_user(authorization)  # Verify authentication
    
    try:
        comments = await social_service.get_post_comments(post_cid)
        return {
            "post_cid": post_cid,
            "comments": comments,
            "count": len(comments)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))