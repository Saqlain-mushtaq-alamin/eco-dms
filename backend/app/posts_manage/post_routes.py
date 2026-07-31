from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from datetime import datetime
from typing import Dict, List
import asyncio
from ..models import PostCreate, CommentCreate, LikeCreate, ImageUpload, VideoUpload
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
from backend.app.services.redis_service import redis_service
# ML verification (async Celery task)
try:
    from backend.ml.worker import verify_eco_content, get_verdict_for_post
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    verify_eco_content = None
    get_verdict_for_post = None

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _status_key(post_cid: str) -> str:
    return f"verification_status:{post_cid}"


def _set_verification_status(post_cid: str, updates: Dict) -> None:
    current = redis_service.get_json(_status_key(post_cid))
    if not isinstance(current, dict):
        current = {}
    current.update(updates)
    current["updated_at"] = datetime.utcnow().isoformat()
    redis_service.set_json(_status_key(post_cid), current)


def _get_verification_state(post_cid: str, has_media: bool) -> Dict:
    state = {
        "verified": False,
        "eco_score": 0.0,
        "signed_verdict_cid": None,
        "verification_status": "none",
        "verification_error": "",
    }

    if not has_media:
        return state

    status_data = redis_service.get_json(_status_key(post_cid))
    status = status_data.get("status") if isinstance(status_data, dict) else None

    if status == "completed":
        verdict_data = get_verdict_for_post(post_cid) if get_verdict_for_post else None
        if isinstance(verdict_data, dict):
            is_eco = bool(verdict_data.get("eco", False))
            state["verified"] = is_eco
            state["eco_score"] = float(verdict_data.get("confidence", 0.0) or 0.0)
            state["signed_verdict_cid"] = verdict_data.get("verdict_cid")
            state["verification_status"] = "verified" if is_eco else "not_eco"
        else:
            state["verification_status"] = "failed"
            state["verification_error"] = "Completed verification but verdict is missing"
        return state

    if status == "failed":
        state["verification_status"] = "failed"
        if isinstance(status_data, dict):
            state["verification_error"] = str(status_data.get("last_error", "") or "")
        return state

    if status in {"processing", "retrying"}:
        state["verification_status"] = "processing"
        if isinstance(status_data, dict):
            state["verification_error"] = str(status_data.get("last_error", "") or "")
        return state

    if status == "queued":
        state["verification_status"] = "queued"
        return state

    state["verification_status"] = "unqueued"
    return state


def _attach_verification_state(post: Dict, post_cid: str) -> None:
    has_media = bool(post.get("media_cids")) or bool(post.get("video_cids"))
    verification = _get_verification_state(post_cid, has_media)
    post.update(verification)


def _next_attempts_for_post(post_cid: str) -> int:
    status_data = redis_service.get_json(_status_key(post_cid))
    if isinstance(status_data, dict):
        return int(status_data.get("attempts", 0) or 0) + 1
    return 1


def _enqueue_verification_task(
    post_cid: str,
    media_cids: List[str],
    content: str,
    author_wallet: str,
    attempts: int,
) -> str:
    from backend.ml.worker import celery_app

    try:
        task = celery_app.send_task(
            'verify_eco_content',
            kwargs={
                'ipfs_cids': media_cids,
                'text_content': content,
                'post_id': post_cid,
                'author_wallet': author_wallet.lower()
            }
        )
        _set_verification_status(
            post_cid,
            {
                "status": "queued",
                "task_id": task.id,
                "attempts": attempts,
                "last_error": "",
                "queued_at": datetime.utcnow().isoformat(),
                "ipfs_cids": media_cids,
                "text_content": content,
                "author_wallet": author_wallet.lower(),
            },
        )
        return task.id
    except Exception as e:
        _set_verification_status(
            post_cid,
            {
                "status": "failed",
                "attempts": attempts,
                "last_error": str(e),
                "queued_at": datetime.utcnow().isoformat(),
                "ipfs_cids": media_cids,
                "text_content": content,
                "author_wallet": author_wallet.lower(),
            },
        )
        raise HTTPException(status_code=503, detail=f"Post exists but ML verification enqueue failed: {e}")


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
        _attach_verification_state(post, post_cid)
    except Exception:
        post["verified"] = False
        post["eco_score"] = 0.0
        post["verification_status"] = "failed" if post.get("media_cids") else "none"
        post["verification_error"] = "Could not resolve verification state"

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


@router.post("/upload-video", response_model=VideoUpload)
async def upload_video(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    """
    Upload a video to IPFS and return its CID.
    Supports common video formats: mp4, webm, mov, avi, mkv.
    Max size: 100MB.
    """
    wallet_address = await get_current_user(authorization)

    ALLOWED_VIDEO_TYPES = {
        "video/mp4", "video/webm", "video/quicktime",
        "video/x-msvideo", "video/x-matroska", "video/ogg",
        "video/mpeg", "video/3gpp", "application/octet-stream",
    }

    content_type = (file.content_type or "").split(";")[0].strip().lower()

    # Fix: reject only if it is neither a video/* MIME nor in our explicit allowlist
    if not content_type.startswith("video/") and content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File must be a video (mp4, webm, mov, avi, mkv). Got: '{content_type}'"
        )

    # Read video bytes
    content = await file.read()
    max_size = 100 * 1024 * 1024  # 100 MB
    if len(content) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Video size must be less than 100MB. Got: {len(content) // (1024*1024)}MB"
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded video file is empty")

    # Normalise content type — browsers sometimes send application/octet-stream for videos
    effective_content_type = content_type if content_type.startswith("video/") else "video/mp4"

    safe_filename = file.filename or "video.mp4"

    try:
        cid = await ipfs_service.pin_file(
            file_content=content,
            filename=safe_filename,
            content_type=effective_content_type,
        )

        # Build public gateway URL (nftstorage / Pinata / ipfs.io depending on config)
        url = f"https://{cid}.ipfs.nftstorage.link"

        return VideoUpload(
            cid=cid,
            url=url,
            content_type=effective_content_type,
            size_bytes=len(content),
        )
    except Exception as e:
        error_msg = str(e)
        print(f"[upload_video] Failed for wallet {wallet_address}: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload video to IPFS: {error_msg}"
        )

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
            "video_cids": payload.video_cids or [],
            "tags": payload.tags or [],
            "created_at": datetime.utcnow().isoformat(),
        })

        # Register post author with social service (needed for OrbitDB lookups)
        social_service.set_post_author(cid, wallet_address.lower())

        ok = await orbitdb_service.append_post(wallet_address.lower(), cid)

        # Combine image and video CIDs for ML verification
        all_media_cids = list(payload.media_cids or [])
        all_video_cids = list(payload.video_cids or [])
        
        # Trigger ML verification for posts with images or videos (async via Celery)
        # This maintains decentralization - verification is optional and off-chain
        if all_media_cids or all_video_cids:
            # For video posts, we pass video CIDs separately so the ML worker
            # can extract keyframes for verification
            task_id = _enqueue_verification_task(
                post_cid=cid,
                media_cids=all_media_cids + all_video_cids,
                content=payload.content,
                author_wallet=wallet_address.lower(),
                attempts=1,
            )
            media_desc = []
            if all_media_cids:
                media_desc.append(f"{len(all_media_cids)} images")
            if all_video_cids:
                media_desc.append(f"{len(all_video_cids)} videos")
            print(f"Triggered merged ML verification for post {cid} with {', '.join(media_desc)} (task={task_id})")
        
        if not ok:
            # We still return success for pinning; client can retry index update
            return {"success": True, "cid": cid, "indexed": False}

        return {"success": True, "cid": cid, "indexed": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{post_cid}/retry-verification", response_model=Dict)
async def retry_verification(
    post_cid: str,
    authorization: str | None = Header(default=None),
):
    """Retry ML verification for a post with media. Restricted to post author."""
    wallet_address = await get_current_user(authorization)

    post = await ipfs_service.get_json(post_cid)
    if not isinstance(post, dict):
        raise HTTPException(status_code=404, detail="Post not found")

    author_wallet = str(post.get("author_wallet") or post.get("author") or "").lower()
    if not author_wallet:
        raise HTTPException(status_code=422, detail="Post author metadata missing")
    if author_wallet != wallet_address.lower():
        raise HTTPException(status_code=403, detail="Only post author can retry verification")

    media_cids = post.get("media_cids") or []
    video_cids = post.get("video_cids") or []
    all_media_cids = list(media_cids) + list(video_cids)
    if not all_media_cids:
        raise HTTPException(status_code=400, detail="Post has no media to verify")

    attempts = _next_attempts_for_post(post_cid)
    task_id = _enqueue_verification_task(
        post_cid=post_cid,
        media_cids=all_media_cids,
        content=str(post.get("content") or ""),
        author_wallet=author_wallet,
        attempts=attempts,
    )
    return {
        "success": True,
        "post_cid": post_cid,
        "task_id": task_id,
        "status": "queued",
        "attempts": attempts,
    }

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
                
                try:
                    _attach_verification_state(post, cid)
                except Exception:
                    post["verified"] = False
                    post["eco_score"] = 0.0
                    post["verification_status"] = "failed" if post.get("media_cids") else "none"
                    post["verification_error"] = "Could not resolve verification state"
                
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
                    
                    try:
                        _attach_verification_state(post, cid)
                    except Exception:
                        post["verified"] = False
                        post["eco_score"] = 0.0
                        post["verification_status"] = "failed" if post.get("media_cids") else "none"
                        post["verification_error"] = "Could not resolve verification state"
                    
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