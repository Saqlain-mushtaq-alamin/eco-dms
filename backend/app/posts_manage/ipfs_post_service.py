import os
import json
from typing import Dict, Optional
from datetime import datetime

import httpx

from backend.app.config import settings
from backend.app.services.pinata_service import pinata_service

NFT_STORAGE_BASE = "https://api.nft.storage"


class PostsIPFS:
    def __init__(self, token: Optional[str] = None):
        # Token is optional; if missing we fall back to local IPFS API
        self.token = token or os.getenv("NFT_STORAGE_TOKEN")
        # Add simple in-memory cache for frequently accessed CIDs
        self._cache: Dict[str, Dict] = {}
        self._cache_max_size = 500  # Increased cache size for better performance

    async def pin_json(self, data: Dict) -> str:
        payload = {**data}
        payload.setdefault("created_at", datetime.utcnow().isoformat())

        if self.token:
            return await self._pin_via_nft_storage(payload)
        else:
            return await self._pin_via_local_ipfs(payload)

    async def get_json(self, cid: str) -> Optional[Dict]:
        """caching and shorter timeout.
        """
        # Check cache first
        if cid in self._cache:
            return self._cache[cid]
        
        # Prefer a public gateway with CID
        gateways = []
        if self.token:
            gateways.append(f"https://{cid}.ipfs.nftstorage.link")
        # Local IPFS HTTP API gateway (if configured)
        api_base = settings.IPFS_API_URL.rstrip("/")
        # Try /cat on API only if IPFS is configured
        if api_base:
            gateways.append(f"{api_base}/cat?arg={cid}")
        # Pinata gateway if configured
        if settings.PINATA_JWT:
            gateways.append(f"https://gateway.pinata.cloud/ipfs/{cid}")
        # Generic public gateway as last resort
        gateways.append(f"https://ipfs.io/ipfs/{cid}")

        for url in gateways:
            try:
                # Reduced timeout from 8 to 5 seconds for faster failure
                async with httpx.AsyncClient(timeout=5) as client:
                    r = await client.get(url)
                if r.status_code >= 300:
                    continue
                text = r.text
                data = json.loads(text)
                
                # Cache the result
                if len(self._cache) >= self._cache_max_size:
                    # Simple cache eviction: remove oldest 20% of items
                    items_to_remove = self._cache_max_size // 5
                    for key in list(self._cache.keys())[:items_to_remove]:
                        del self._cache[key]
                self._cache[cid] = data
                
                return data
            except Exception:
                continue
        return None

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
        
        # If IPFS_API_URL is not configured, try Pinata instead
        if not api_base:
            if settings.PINATA_JWT:
                print("ℹ️ IPFS not configured, using Pinata instead")
                cid = pinata_service.pin_json(payload)
                if cid:
                    return cid
                raise RuntimeError("Pinata pin_json failed")
            else:
                raise RuntimeError(
                    "Neither IPFS_API_URL nor PINATA_JWT is configured. "
                    "Please set either IPFS_API_URL (e.g., 'http://127.0.0.1:5001/api/v0') "
                    "or PINATA_JWT in your .env file."
                )
        
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

    async def pin_file(self, file_content: bytes, filename: str, content_type: str) -> str:
        """
        Upload a file (e.g., image) to IPFS and return its CID.
        """
        if self.token:
            return await self._pin_file_via_nft_storage(file_content, filename, content_type)
        else:
            return await self._pin_file_via_local_ipfs(file_content, filename, content_type)

    async def _pin_file_via_nft_storage(self, file_content: bytes, filename: str, content_type: str) -> str:
        """Upload file to nft.storage"""
        async with httpx.AsyncClient(timeout=60) as client:
            files = {"file": (filename, file_content, content_type)}
            r = await client.post(
                f"{NFT_STORAGE_BASE}/upload",
                headers={"Authorization": f"Bearer {self.token}"},
                files=files,
            )
        if r.status_code >= 300:
            raise RuntimeError(f"nft.storage file upload failed: {r.status_code} {r.text}")
        resp = r.json()
        cid = resp.get("value", {}).get("cid") or resp.get("cid")
        if not cid:
            raise RuntimeError(f"Missing CID in nft.storage response: {resp}")
        return cid

    async def _pin_file_via_local_ipfs(self, file_content: bytes, filename: str, content_type: str) -> str:
        """Upload file to local IPFS node"""
        api_base = settings.IPFS_API_URL.rstrip("/")
        
        # If IPFS_API_URL is not configured, try Pinata instead
        if not api_base:
            if settings.PINATA_JWT:
                print("ℹ️ IPFS not configured, using Pinata for file upload")
                cid = pinata_service.pin_file_bytes(file_content, filename)
                if cid:
                    return cid
                raise RuntimeError("Pinata file upload failed")
            else:
                raise RuntimeError(
                    "Neither IPFS_API_URL nor PINATA_JWT is configured. "
                    "Please set either IPFS_API_URL or PINATA_JWT in your .env file."
                )
        
        files = {"file": (filename, file_content, content_type)}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{api_base}/add", params={"pin": "true"}, files=files)
        if r.status_code >= 300:
            raise RuntimeError(f"IPFS file /add failed: {r.status_code} {r.text}")
        resp = r.json()
        cid = resp.get("Hash")
        if not cid:
            raise RuntimeError(f"Missing CID in IPFS file /add response: {resp}")
        return cid


ipfs_service = PostsIPFS()