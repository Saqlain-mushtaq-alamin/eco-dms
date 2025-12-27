import json
from typing import List, Optional
import httpx
from backend.app.config import settings
from backend.app.services.redis_service import redis_service


class CeramicService:
    """
    Minimal Ceramic/IDX client that stores a list of CIDs per author wallet.
    Falls back to Redis if Ceramic is not available.
    """
    def __init__(self):
        
        self.base = settings.CERAMIC_API_URL.rstrip("/")
        self.model_stream = settings.CERAMIC_POSTS_MODEL_STREAM
        self.use_redis_fallback = not self.model_stream  # Use Redis if model stream not configured

    async def get_author_posts(self, wallet_address: str) -> List[str]:
        """
        Return list of CIDs for an author from Ceramic or Redis fallback. Empty on not found.
        """
        # Try Redis fallback first if Ceramic not configured
        if self.use_redis_fallback:
            return await self._get_posts_from_redis(wallet_address)
        
        # Try Ceramic
        try:
            url = f"{self.base}/api/v1/models/{self.model_stream}/records/{wallet_address.lower()}"
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(url)
            if r.status_code >= 300:
                # Fallback to Redis
                return await self._get_posts_from_redis(wallet_address)
            data = r.json()
            cids = data.get("cids") or data.get("value") or []
            if not isinstance(cids, list):
                return []
            return [str(c) for c in cids]
        except Exception:
            # Fallback to Redis
            return await self._get_posts_from_redis(wallet_address)

    async def append_author_post(self, wallet_address: str, cid: str) -> bool:
        """
        Append CID to author's posts list in Ceramic or Redis fallback.
        """
        # Try Redis fallback first if Ceramic not configured
        if self.use_redis_fallback:
            return await self._append_post_to_redis(wallet_address, cid)
        
        # Try Ceramic
        try:
            url = f"{self.base}/api/v1/models/{self.model_stream}/records/{wallet_address.lower()}"
            payload = {"op": "append", "cid": cid}
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(url, json=payload)
            if r.status_code < 300:
                return True
            # Fallback to Redis
            return await self._append_post_to_redis(wallet_address, cid)
        except Exception:
            # Fallback to Redis
            return await self._append_post_to_redis(wallet_address, cid)

    async def _get_posts_from_redis(self, wallet_address: str) -> List[str]:
        """Get posts from Redis fallback storage"""
        try:
            key = f"posts:{wallet_address.lower()}"
            data = await redis_service.get(key)
            if data:
                cids = json.loads(data)
                return cids if isinstance(cids, list) else []
            return []
        except Exception:
            return []

    async def _append_post_to_redis(self, wallet_address: str, cid: str) -> bool:
        """Append post to Redis fallback storage"""
        try:
            key = f"posts:{wallet_address.lower()}"
            data = await redis_service.get(key)
            cids = json.loads(data) if data else []
            if not isinstance(cids, list):
                cids = []
            # Add new CID at the beginning (most recent first)
            cids.insert(0, cid)
            # Store back to Redis (no expiration for posts)
            await redis_service.set(key, json.dumps(cids))
            return True
        except Exception as e:
            print(f"Redis fallback error: {e}")
            return False

ceramic_service = CeramicService()