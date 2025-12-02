import os
import json
from datetime import datetime
from typing import Dict
import httpx

NFT_STORAGE_BASE = "https://api.nft.storage"
NFT_STORAGE_TOKEN = os.getenv("NFT_STORAGE_TOKEN")

class IPFSService:
    def __init__(self, token: str | None = None):
        self.token = token or NFT_STORAGE_TOKEN
        if not self.token:
            raise RuntimeError("NFT_STORAGE_TOKEN env var is required")

    async def pin_json(self, data: Dict) -> str:
        payload = {
            "type": "application/json",
            "value": {**data, "created_at": data.get("created_at") or datetime.utcnow().isoformat()},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{NFT_STORAGE_BASE}/upload",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload),
            )
        if r.status_code >= 300:
            raise RuntimeError(f"nft.storage upload failed: {r.status_code} {r.text}")
        resp = r.json()
        cid = resp.get("value", {}).get("cid") or resp.get("cid")
        if not cid:
            raise RuntimeError(f"Missing CID in response: {resp}")
        return cid

ipfs_service = IPFSService()