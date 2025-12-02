import os
import json
from typing import Dict, Optional
from datetime import datetime

import httpx

from backend.app.config import settings

NFT_STORAGE_BASE = "https://api.nft.storage"


class PostsIPFS:
    def __init__(self, token: Optional[str] = None):
        # Token is optional; if missing we fall back to local IPFS API
        self.token = token or os.getenv("NFT_STORAGE_TOKEN")

    async def pin_json(self, data: Dict) -> str:
        payload = {**data}
        payload.setdefault("created_at", datetime.utcnow().isoformat())

        if self.token:
            return await self._pin_via_nft_storage(payload)
        else:
            return await self._pin_via_local_ipfs(payload)

    async def _pin_via_nft_storage(self, payload: Dict) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{NFT_STORAGE_BASE}/upload",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                },
                content=json.dumps({"type": "application/json", "value": payload}),
            )
        if r.status_code >= 300:
            raise RuntimeError(f"nft.storage upload failed: {r.status_code} {r.text}")
        resp = r.json()
        cid = resp.get("value", {}).get("cid") or resp.get("cid")
        if not cid:
            raise RuntimeError(f"Missing CID in nft.storage response: {resp}")
        return cid

    async def _pin_via_local_ipfs(self, payload: Dict) -> str:
        # Use local IPFS HTTP API as a fallback
        api_base = settings.IPFS_API_URL.rstrip("/")
        files = {"file": ("post.json", json.dumps(payload), "application/json")}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{api_base}/add", params={"pin": "true"}, files=files)
        if r.status_code >= 300:
            raise RuntimeError(f"IPFS /add failed: {r.status_code} {r.text}")
        resp = r.json()
        cid = resp.get("Hash")
        if not cid:
            raise RuntimeError(f"Missing CID in IPFS /add response: {resp}")
        return cid


ipfs_service = PostsIPFS()