from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Dict, List
from ..models import PostCreate
from ..auth_routes import get_current_user
# Use posts IPFS service for pin/get
from backend.app.posts_manage.ipfs_post_service import ipfs_service
# Import Redis from shared services
from backend.app.services.redis_service import redis_service

router = APIRouter(prefix="/api/posts", tags=["posts"])

@router.post("", response_model=Dict)
async def create_post(
    payload: PostCreate,
    wallet_address: str = Depends(get_current_user),
):
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
        # index post CID by author for fast listing
        try:
            redis_service.client.sadd(f"posts:{wallet_address.lower()}", cid)
        except Exception:
            pass
        return {"success": True, "cid": cid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{wallet_address}", response_model=Dict)
async def list_author_posts(
    wallet_address: str,
    current_user: str = Depends(get_current_user),
):
    """
    List posts for an author. Uses Redis index for CIDs and fetches content from IPFS.
    """
    key = f"posts:{wallet_address.lower()}"
    try:
        cids: List[str] = list(await redis_service.client.smembers(key))  # may be empty
    except Exception:
        cids = []

    posts: List[dict] = []
    for cid in cids:
        try:
            post = await ipfs_service.get_json(cid)  # now async
            if post:
                post["cid"] = cid
                posts.append(post)
        except Exception:
            continue

    return {"author_wallet": wallet_address.lower(), "count": len(posts), "posts": posts}

@router.post("/inference", response_model=Dict)
async def inference_stub(
    wallet_address: str = Depends(get_current_user),
):
    return {"eco": None}