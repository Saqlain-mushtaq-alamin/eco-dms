from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Dict, List
from ..models import PostCreate
from ..auth_routes import get_current_user
# Use posts IPFS service for pin/get
from backend.app.posts_manage.ipfs_post_service import ipfs_service
# Use Ceramic/IDX for decentralized CID indexing
from backend.app.services.ceramic_service import ceramic_service

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
    current_user: str = Depends(get_current_user),
):
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
                posts.append(post)
        except Exception:
            continue

    return {"author_wallet": wallet_address.lower(), "count": len(posts), "posts": posts}

@router.post("/inference", response_model=Dict)
async def inference_stub(
    wallet_address: str = Depends(get_current_user),
):
    return {"eco": None}