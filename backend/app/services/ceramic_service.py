import json
from typing import List, Optional
import httpx
from backend.app.config import settings

class CeramicService:
    """
    Minimal Ceramic/IDX client that stores a list of CIDs per author wallet.
    Replace endpoints with your Ceramic node + model definitions.
    """
    def __init__(self):
        self.base = settings.CERAMIC_API_URL.rstrip("/")  # e.g., http://localhost:7007
        # Model/definition where we store per-author posts list (array of CIDs)
        self.model_stream = settings.CERAMIC_POSTS_MODEL_STREAM  # e.g., a StreamID or model ID

    async def get_author_posts(self, wallet_address: str) -> List[str]:
        """
        Return list of CIDs for an author from Ceramic. Empty on not found.
        """
        try:
            url = f"{self.base}/api/v1/models/{self.model_stream}/records/{wallet_address.lower()}"
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(url)
            if r.status_code >= 300:
                return []
            data = r.json()
            cids = data.get("cids") or data.get("value") or []
            if not isinstance(cids, list):
                return []
            return [str(c) for c in cids]
        except Exception:
            return []

    async def append_author_post(self, wallet_address: str, cid: str) -> bool:
        """
        Append CID to author's posts list in Ceramic (upsert).
        """
        try:
            url = f"{self.base}/api/v1/models/{self.model_stream}/records/{wallet_address.lower()}"
            payload = {"op": "append", "cid": cid}
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(url, json=payload)
            return r.status_code < 300
        except Exception:
            return False

ceramic_service = CeramicService()