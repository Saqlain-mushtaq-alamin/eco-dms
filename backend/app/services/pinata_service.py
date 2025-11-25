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


# Global Pinata service instance
pinata_service = PinataService()