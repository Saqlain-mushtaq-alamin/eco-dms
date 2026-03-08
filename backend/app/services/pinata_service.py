"""
Pinata Service - pins content to ensure availability.
Free tier: 1GB storage, good for testing.
"""
import requests
import json
from typing import Dict, Any, Optional
import sys
import os
import io
from backend.app.config import settings

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings


class PinataService:
    """
    Pinata keeps your IPFS content online 24/7.
    Without pinning, content can be garbage collected.
    """
    
    def __init__(self):
        """Initialize Pinata API."""
        self.jwt = settings.PINATA_JWT
        self.base_url = "https://api.pinata.cloud"
        
        if self.jwt:
            self.headers = {"Authorization": f"Bearer {self.jwt}"}
        else:
            print("⚠️ Pinata JWT not configured in .env")
            self.headers = {}
    
    def pin_json(self, data: Dict[str, Any], name: Optional[str] = None) -> Optional[str]:
        """Pin JSON data to Pinata."""
        if not self.jwt:
            print("❌ Pinata not configured")
            return None
        
        url = f"{self.base_url}/pinning/pinJSONToIPFS"
        
        payload = {
            "pinataContent": data,
            "pinataMetadata": {"name": name or "eco-dms-data"}
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            cid = result['IpfsHash']
            print(f"📌 Pinned to Pinata: {cid}")
            return cid
        except Exception as e:
            print(f"❌ Pinata pin failed: {e}")
            return None
    
    def pin_file_bytes(self, data: bytes, filename: str = "file") -> Optional[str]:
        """Pin file bytes to Pinata."""
        if not self.jwt:
            return None
        
        url = f"{self.base_url}/pinning/pinFileToIPFS"
        
        files = {"file": (filename, io.BytesIO(data))}
        
        try:
            response = requests.post(url, headers=self.headers, files=files)
            response.raise_for_status()
            
            result = response.json()
            cid = result['IpfsHash']
            print(f"📌 File pinned: {cid}")
            return cid
        except Exception as e:
            print(f"❌ File pin failed: {e}")
            return None
    
    def get_latest_cid_by_name(self, name: str) -> Optional[str]:
        """
        Query Pinata pin list and return the CID of the most recently pinned
        item whose metadata name matches `name` exactly.

        Used as a last-resort recovery when Redis is wiped: as long as data
        was pinned to Pinata with a deterministic name, we can always find it.
        """
        if not self.jwt:
            return None
        try:
            response = requests.get(
                f"{self.base_url}/data/pinList",
                headers=self.headers,
                params={
                    "metadata[name]": name,
                    "pageLimit": 1,
                    "pageOffset": 0,
                    "status": "pinned",
                    "sort": "date_pinned",
                    "order": "DESC",
                },
                timeout=15,
            )
            response.raise_for_status()
            rows = response.json().get("rows", [])
            if rows:
                cid = rows[0].get("ipfs_pin_hash")
                if cid:
                    print(f"🔍 Recovered CID by Pinata name '{name}': {cid}")
                    return cid
        except Exception as e:
            print(f"⚠️ Pinata name lookup failed for '{name}': {e}")
        return None

    def pin_by_cid(self, cid: str, name: Optional[str] = None) -> bool:
        """Pin existing IPFS content."""
        if not self.jwt:
            return False
        
        url = f"{self.base_url}/pinning/pinByHash"
        
        payload = {
            "hashToPin": cid,
            "pinataMetadata": {"name": name or f"eco-dms-{cid[:8]}"}
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            print(f"📌 CID pinned: {cid}")
            return True
        except Exception as e:
            print(f"❌ Pin CID failed: {e}")
            return False
        
        #!  this code is for development/testing purposes only !___________________and it unpins all pins from Pinata
    
    # >>> DEV-ONLY: Unpin all pins from Pinata (dangerous; dev only)
    def unpin_all(self) -> dict:
        if not self.jwt:
            return {"ok": False, "error": "PINATA_JWT missing"}
        headers = {"Authorization": f"Bearer {self.jwt}"}
        deleted = 0
        page_offset = 0
        page_limit = 100
        while True:
            r = requests.get(
                "https://api.pinata.cloud/data/pinList",
                headers=headers,
                params={"pageLimit": page_limit, "pageOffset": page_offset},
                timeout=30,
            )
            if not r.ok:
                return {"ok": False, "error": f"pinList {r.status_code}: {r.text}"}
            items = r.json().get("rows", [])
            if not items:
                break
            for row in items:
                cid = row.get("ipfs_pin_hash")
                if not cid:
                    continue
                d = requests.delete(
                    f"https://api.pinata.cloud/pinning/unpin/{cid}",
                    headers=headers,
                    timeout=30,
                )
                if d.ok:
                    deleted += 1
            if len(items) < page_limit:
                break
            page_offset += page_limit
        return {"ok": True, "deleted": deleted}
    # <<< DEV-ONLY


# Global Pinata service instance
pinata_service = PinataService()