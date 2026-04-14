from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from datetime import datetime
from typing import Dict, List
import asyncio
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
from backend.app.services.notification_service import notification_service
# ML verification (async Celery task)
try:
    from backend.ml.worker import verify_eco_content, get_verdict_for_post
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    verify_eco_content = None
    get_verdict_for_post = None

router = APIRouter(prefix="/api/posts", tags=["posts"])


async def _get_post_author_wallet(post_cid: str) -> str | None:
    post_data = await ipfs_service.get_json(post_cid)
    if isinstance(post_data, dict):
        author = post_data.get("author_wallet") or post_data.get("author")
        if isinstance(author, str) and author:
            return author.lower()
    return None


@router.get("/by-cid/{post_cid}", response_model=Dict)
async def get_post_by_cid(
    post_cid: str,
    authorization: str | None = Header(default=None),
):
    current_user = await get_current_user(authorization)

    post = await ipfs_service.get_json(post_cid)
    if not isinstance(post, dict):
        raise HTTPException(status_code=404, detail="Post not found")

    author = post.get("author") or post.get("author_wallet")
    if author:
        social_service.set_post_author(post_cid, str(author))

    likes_count, comments_count, liked_by_user = await asyncio.gather(
        social_service.get_likes_count(post_cid),
        social_service.get_comments_count(post_cid),
        social_service.has_user_liked(post_cid, current_user),
        return_exceptions=True,
    )

    post["cid"] = post_cid
    post["likes_count"] = 0 if isinstance(likes_count, (Exception, BaseException)) else (likes_count or 0)
    post["comments_count"] = 0 if isinstance(comments_count, (Exception, BaseException)) else (comments_count or 0)
    post["liked_by_user"] = False if isinstance(liked_by_user, (Exception, BaseException)) else bool(liked_by_user)

    try:
        if ML_AVAILABLE and get_verdict_for_post:
            verdict_data = get_verdict_for_post(post_cid)
            if verdict_data:
                post["verified"] = verdict_data.get("eco", False)
                post["eco_score"] = verdict_data.get("confidence", 0.0)
                post["signed_verdict_cid"] = verdict_data.get("verdict_cid")
                post["verification_status"] = "verified"
            else:
                post["verified"] = False
                post["eco_score"] = 0.0
                post["verification_status"] = "pending" if post.get("media_cids") else "none"
        else:
            post["verified"] = False
            post["eco_score"] = 0.0
            post["verification_status"] = "pending" if post.get("media_cids") else "none"
    except Exception:
        post["verified"] = False
        post["eco_score"] = 0.0
        post["verification_status"] = "pending" if post.get("media_cids") else "none"

    return {"post": post}

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
        
        # Trigger ML verification for posts with images (async via Celery)
        # This maintains decentralization - verification is optional and off-chain
        if ML_AVAILABLE and verify_eco_content and payload.media_cids:
            try:
                # Send one task with all images so ML can produce a merged verdict per post.
                from backend.ml.worker import celery_app
                celery_app.send_task(
                    'verify_eco_content',
                    kwargs={
                        'ipfs_cids': payload.media_cids,
                        'text_content': payload.content,
                        'post_id': cid,
                        'author_wallet': wallet_address.lower()
                    }
                )
                print(f"Triggered merged ML verification for post {cid} with {len(payload.media_cids)} images")
            except Exception as e:
                print(f"Warning: Failed to trigger ML verification: {e}")
                # Don't fail the post creation if ML verification fails
        
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
    limit: int = 20,  # Default 20 posts
    offset: int = 0,
):
    current_user = await get_current_user(authorization)
    """
    List posts for an author via OrbitDB index; fetch content from IPFS.
    Optimized: Parallel fetching of posts and social metrics + pagination.
    """
    try:
        all_cids: List[str] = await orbitdb_service.get_user_posts(wallet_address.lower())
    except Exception:
        all_cids = []

    if not all_cids:
        return {"author_wallet": wallet_address.lower(), "count": 0, "total": 0, "posts": []}

    # Apply pagination
    total = len(all_cids)
    cids = all_cids[offset:offset + limit]
    
    if not cids:
        return {"author_wallet": wallet_address.lower(), "count": 0, "total": total, "posts": []}

    # Fetch all posts in parallel (much faster!)
    import asyncio
    
    async def fetch_post_with_metrics(cid: str):
        try:
            # Fetch post content and metrics in parallel
            post_task = ipfs_service.get_json(cid)
            likes_task = social_service.get_likes_count(cid)
            comments_task = social_service.get_comments_count(cid)
            liked_task = social_service.has_user_liked(cid, current_user)
            
            results = await asyncio.gather(
                post_task, likes_task, comments_task, liked_task,
                return_exceptions=True
            )
            
            post, likes_count, comments_count, liked_by_user = results
            
            # Filter out any exception types (including CancelledError)
            if isinstance(post, (Exception, BaseException)) or not post:
                return None
            
            # Handle exceptions in results - ensure we return valid types only
            if isinstance(post, dict):
                post["cid"] = cid
                post["likes_count"] = 0 if isinstance(likes_count, (Exception, BaseException)) else (likes_count or 0)
                post["comments_count"] = 0 if isinstance(comments_count, (Exception, BaseException)) else (comments_count or 0)
                post["liked_by_user"] = False if isinstance(liked_by_user, (Exception, BaseException)) else bool(liked_by_user)
                
                # Fetch verification data if available
                try:
                    if ML_AVAILABLE and get_verdict_for_post:
                        verdict_data = get_verdict_for_post(cid)
                        if verdict_data:
                            post["verified"] = verdict_data.get("eco", False)
                            post["eco_score"] = verdict_data.get("confidence", 0.0)
                            post["signed_verdict_cid"] = verdict_data.get("verdict_cid")
                            post["verification_status"] = "verified"
                        else:
                            post["verified"] = False
                            post["eco_score"] = 0.0
                            post["verification_status"] = "pending" if post.get("media_cids") else "none"
                    else:
                        post["verified"] = False
                        post["eco_score"] = 0.0
                        post["verification_status"] = "pending" if post.get("media_cids") else "none"
                except Exception:
                    post["verified"] = False
                    post["eco_score"] = 0.0
                    post["verification_status"] = "pending" if post.get("media_cids") else "none"
                
                return post
            return None
        except (Exception, asyncio.CancelledError):
            return None
    
    # Fetch all posts concurrently
    posts = await asyncio.gather(*[fetch_post_with_metrics(cid) for cid in cids])
    posts = [p for p in posts if p is not None]

    return {
        "author_wallet": wallet_address.lower(), 
        "count": len(posts), 
        "total": total,
        "posts": posts
    }

@router.get("/feed/timeline", response_model=Dict)
async def get_feed_timeline(
    authorization: str | None = Header(default=None),
    limit: int = 50,  # Limit number of posts to improve performance
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
        
        # Limit the number of posts to fetch (most recent only)
        # Note: Posts are already sorted by time in OrbitDB feeds
        all_cids = all_cids[:limit]
        
        # Fetch post details with metrics
        async def fetch_post_with_metrics(cid: str):
            try:
                # Fetch post first to get author
                post = await ipfs_service.get_json(cid)
                
                if isinstance(post, (Exception, BaseException)) or not post:
                    return None
                
                # Register post author to avoid IPFS fetch in social service
                author = post.get("author") or post.get("author_wallet")
                if author:
                    social_service.set_post_author(cid, author)
                
                # Now fetch metrics in parallel
                results = await asyncio.gather(
                    social_service.get_likes_count(cid),
                    social_service.get_comments_count(cid),
                    social_service.has_user_liked(cid, current_user),
                    return_exceptions=True
                )
                
                likes_count, comments_count, liked_by_user = results
                
                if isinstance(post, dict):
                    post["cid"] = cid
                    post["likes_count"] = 0 if isinstance(likes_count, (Exception, BaseException)) else (likes_count or 0)
                    post["comments_count"] = 0 if isinstance(comments_count, (Exception, BaseException)) else (comments_count or 0)
                    post["liked_by_user"] = False if isinstance(liked_by_user, (Exception, BaseException)) else bool(liked_by_user)
                    
                    # Fetch verification data if available
                    try:
                        if ML_AVAILABLE and get_verdict_for_post:
                            verdict_data = get_verdict_for_post(cid)
                            if verdict_data:
                                post["verified"] = verdict_data.get("eco", False)
                                post["eco_score"] = verdict_data.get("confidence", 0.0)
                                post["signed_verdict_cid"] = verdict_data.get("verdict_cid")
                                post["verification_status"] = "verified"
                            else:
                                post["verified"] = False
                                post["eco_score"] = 0.0
                                post["verification_status"] = "pending" if post.get("media_cids") else "none"
                        else:
                            post["verified"] = False
                            post["eco_score"] = 0.0
                            post["verification_status"] = "pending" if post.get("media_cids") else "none"
                    except Exception:
                        post["verified"] = False
                        post["eco_score"] = 0.0
                        post["verification_status"] = "pending" if post.get("media_cids") else "none"
                    
                    return post
                return None
            except (Exception, asyncio.CancelledError):
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

            # Notify post author for new like (skip self-likes)
            try:
                post_author = await _get_post_author_wallet(post_cid)
                if post_author and post_author != wallet_address.lower():
                    await notification_service.create_notification(
                        recipient_wallet=post_author,
                        event_type="like",
                        message=f"{wallet_address[:6]}...{wallet_address[-4:]} liked your post",
                        actor_wallet=wallet_address,
                        post_cid=post_cid,
                        metadata={"likes_count": likes_count},
                    )
            except Exception as notify_error:
                print(f"⚠️ Failed to emit like notification: {notify_error}")

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

            # Notify post author for new comment (skip self-comments)
            try:
                post_author = await _get_post_author_wallet(post_cid)
                if post_author and post_author != wallet_address.lower():
                    await notification_service.create_notification(
                        recipient_wallet=post_author,
                        event_type="comment",
                        message=f"{wallet_address[:6]}...{wallet_address[-4:]} commented on your post",
                        actor_wallet=wallet_address,
                        post_cid=post_cid,
                        metadata={
                            "comment_cid": comment_cid,
                            "comment_preview": payload.content[:120],
                            "comments_count": comments_count,
                        },
                    )
            except Exception as notify_error:
                print(f"⚠️ Failed to emit comment notification: {notify_error}")

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