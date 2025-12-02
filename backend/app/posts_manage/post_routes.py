from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Dict
from ..models import PostCreate
from ..auth_routes import get_current_user
from .ipfs_service import ipfs_service

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
        return {"success": True, "cid": cid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
#-------------------------stub for future inference ml eco verification service-------------------------#
@router.post("/inference", response_model=Dict)
async def inference_stub(
    wallet_address: str = Depends(get_current_user),
):
    return {"eco": None}