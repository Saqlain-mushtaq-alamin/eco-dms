from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from datetime import datetime
from typing import Dict, List
from ..models import PostCreate, CommentCreate, LikeCreate, ImageUpload
from ..auth_routes import get_current_user
# Use posts IPFS service for pin/get
from backend.app.posts_manage.ipfs_post_service import ipfs_service
# Use OrbitDB for decentralized CID indexing (FREE, no gas fees!)
from backend.app.services.orbitdb_service import orbitdb_service
# Use social service for likes and comments
from backend.app.services.social_service import social_service
# User service for follow relationships
from backend.app.services.user_service import user_service

router = APIRouter(prefix="/api/posts", tags=["posts"])

@router.post("/upload-image", response_model=ImageUpload)
async def upload_image(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    """
    Upload an image to IPFS and return its CID.
    Supports common image formats: jpg, jpeg, png, gif, webp.
    """
    wallet_address = await get_current_user(authorization)
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Validate file size (10MB max)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be less than 10MB")
    
    try:
        cid = await ipfs_service.pin_file(
            file_content=content,
            filename=file.filename or "image",
            content_type=file.content_type
        )
        
        # Generate public URL for the image
        # Try NFT.storage gateway first, fallback to ipfs.io
        url = f"https://{cid}.ipfs.nftstorage.link"
        
        return ImageUpload(cid=cid, url=url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@router.post("", response_model=Dict)
async def create_post(
    payload: PostCreate,
    authorization: str | None = Header(default=None),
):
    wallet_address = await get_current_user(authorization)
    if wallet_address.lower() != payload.author_wallet.lower():
        raise HTTPException(
            status_code=403, 
            detail=f"Author wallet mismatch: authenticated as {wallet_address.lower()}, but payload has {payload.author_wallet.lower()}"
        )
    try:
        cid = await ipfs_service.pin_json({
            "type": "post",
            "version": 1,
            "author": wallet_address.lower(),  # Add author field for social service
            "author_wallet": wallet_address.lower(),
            "content": payload.content,
            "media_cids": payload.media_cids or [],
            "tags": payload.tags or [],
            "created_at": datetime.utcnow().isoformat(),
        })

        # Register post author with social service (needed for OrbitDB lookups)
        social_service.set_post_author(cid, wallet_address.lower())

        ok = await orbitdb_service.append_post(wallet_address.lower(), cid)
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
    List posts for an author via OrbitDB index; fetch content from IPFS.
    Optimized: Parallel fetching of posts and social metrics.
    """
    try:
        cids: List[str] = await orbitdb_service.get_user_posts(wallet_address.lower())
    except Exception:
        cids = []

    if not cids:
        return {"author_wallet": wallet_address.lower(), "count": 0, "posts": []}

    # Fetch all posts in parallel (much faster!)
    import asyncio
    
    async def fetch_post_with_metrics(cid: str):
        try:
            # Fetch post content and metrics in parallel
            post_task = ipfs_service.get_json(cid)
            likes_task = social_service.get_likes_count(cid)
            comments_task = social_service.get_comments_count(cid)
            liked_task = social_service.has_user_liked(cid, current_user)
            
            post, likes_count, comments_count, liked_by_user = await asyncio.gather(
                post_task, likes_task, comments_task, liked_task,
                return_exceptions=True
            )
            
            if isinstance(post, Exception) or not post:
                return None
            
            # Handle exceptions in results
            if isinstance(post, dict):
                post["cid"] = cid
                post["likes_count"] = 0 if isinstance(likes_count, Exception) else likes_count
                post["comments_count"] = 0 if isinstance(comments_count, Exception) else comments_count
                post["liked_by_user"] = False if isinstance(liked_by_user, Exception) else liked_by_user
                return post
            return None
        except Exception:
            return None
    
    # Fetch all posts concurrently
    posts = await asyncio.gather(*[fetch_post_with_metrics(cid) for cid in cids])
    posts = [p for p in posts if p is not None]

    return {"author_wallet": wallet_address.lower(), "count": len(posts), "posts": posts}

@router.get("/feed/timeline", response_model=Dict)
async def get_feed_timeline(
    authorization: str | None = Header(default=None),
):
    """
    Get personalized feed showing posts from users that the current user follows.
    """
    current_user = await get_current_user(authorization)
    
    try:
        # Get list of users current user follows
        following = await user_service.get_following(current_user.lower())
        
        if not following:
            return {"count": 0, "posts": [], "message": "Follow users to see their posts in your feed"}
        
        # Fetch posts from all followed users
        import asyncio
        
        async def fetch_user_posts(wallet_address: str):
            try:
                cids = await orbitdb_service.get_user_posts(wallet_address.lower())
                return cids if cids else []
            except Exception:
                return []
        
        # Get all CIDs from followed users
        all_cids_lists = await asyncio.gather(*[fetch_user_posts(addr) for addr in following])
        all_cids = [cid for cids in all_cids_lists for cid in cids]
        
        if not all_cids:
            return {"count": 0, "posts": [], "message": "No posts from followed users yet"}
        
        # Fetch post details with metrics
        async def fetch_post_with_metrics(cid: str):
            try:
                post_task = ipfs_service.get_json(cid)
                likes_task = social_service.get_likes_count(cid)
                comments_task = social_service.get_comments_count(cid)
                liked_task = social_service.has_user_liked(cid, current_user)
                
                post, likes_count, comments_count, liked_by_user = await asyncio.gather(
                    post_task, likes_task, comments_task, liked_task,
                    return_exceptions=True
                )
                
                if isinstance(post, Exception) or not post:
                    return None
                
                if isinstance(post, dict):
                    post["cid"] = cid
                    post["likes_count"] = 0 if isinstance(likes_count, Exception) else likes_count
                    post["comments_count"] = 0 if isinstance(comments_count, Exception) else comments_count
                    post["liked_by_user"] = False if isinstance(liked_by_user, Exception) else liked_by_user
                    return post
                return None
            except Exception:
                return None
        
        posts = await asyncio.gather(*[fetch_post_with_metrics(cid) for cid in all_cids])
        posts = [p for p in posts if p is not None]
        
        # Sort by created_at descending (newest first)
        posts.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {"count": len(posts), "posts": posts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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