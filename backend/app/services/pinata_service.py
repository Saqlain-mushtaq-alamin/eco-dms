"""
Pinata Service - pins content to ensure availability.
Free tier: 1GB storage, good for testing.
"""
import requests
from typing import Dict, Any, Optional
import sys
import os

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
            print("⚠️ Pinata JWT not configured")
            self.headers = {}
    
    def pin_json(self, data: Dict[str, Any], name: str = None) -> Optional[str]:
        """
        Pin JSON data to Pinata.
        
        Args:
            data: Dictionary to pin
            name: Optional name for this pin
            
        Returns:
            IPFS CID
            
        Example:
            cid = pinata.pin_json({"user": "alice"}, name="user_alice")
        """
        if not self.jwt:
            print("⚠️ Pinata not configured, skipping pin")
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
    
    def pin_by_cid(self, cid: str, name: str = None) -> bool:
        """
        Pin existing IPFS content by CID.
        
        Args:
            cid: Content identifier to pin
            name: Optional name
            
        Returns:
            True if successful
        """
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
            print(f"📌 Pinned CID: {cid}")
            return True
        except Exception as e:
            print(f"❌ Pin failed: {e}")
            return False


# Global Pinata service instance
pinata_service = PinataService()