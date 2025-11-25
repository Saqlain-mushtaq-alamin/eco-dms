"""
IPFS Service with Pinata fallback.
Works without local IPFS node.
"""
import json
from typing import Dict, Any, Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings


class IPFSService:
    """
    IPFS service with Pinata-only mode support.
    If no local IPFS, falls back to Pinata API.
    """
    
    def __init__(self):
        """Initialize IPFS or Pinata-only mode."""
        self.client = None
        self.pinata_only = False
        
        if settings.IPFS_API_URL:
            # Try to connect to local IPFS
            try:
                import ipfshttpclient
                self.client = ipfshttpclient.connect(settings.IPFS_API_URL)
                print(f"✅ Connected to IPFS at {settings.IPFS_API_URL}")
            except Exception as e:
                print(f"⚠️ IPFS connection failed: {e}")
                print("💡 Falling back to Pinata-only mode")
                self.pinata_only = True
        else:
            # Pinata-only mode
            print("📌 Running in Pinata-only mode (no local IPFS)")
            self.pinata_only = True
    
    def add_json(self, data: Dict[str, Any]) -> Optional[str]:
        """Add JSON to IPFS or Pinata."""
        if self.client and not self.pinata_only:
            # Use local IPFS
            try:
                result = self.client.add_json(data)
                print(f"✅ Added to IPFS: {result}")
                return result
            except Exception as e:
                print(f"❌ IPFS add failed: {e}")
                return None
        else:
            # Use Pinata API directly
            from services.pinata_service import pinata_service
            cid = pinata_service.pin_json(data)
            return cid
    
    def get_json(self, cid: str) -> Optional[Dict[str, Any]]:
        """Get JSON from IPFS or Pinata gateway."""
        if self.client and not self.pinata_only:
            try:
                return self.client.get_json(cid)
            except Exception as e:
                print(f"❌ IPFS get failed: {e}")
                # Fallback to HTTP gateway
                pass
        
        # Fetch from HTTP gateway
        try:
            import requests
            url = f"{settings.IPFS_GATEWAY_URL}{cid}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ Gateway fetch failed: {e}")
            return None
    
    def add_bytes(self, data: bytes) -> Optional[str]:
        """Add bytes to IPFS or Pinata."""
        if self.client and not self.pinata_only:
            try:
                result = self.client.add_bytes(data)
                print(f"✅ Bytes added to IPFS: {result}")
                return result
            except Exception as e:
                print(f"❌ IPFS add bytes failed: {e}")
                return None
        else:
            # Use Pinata file upload
            from services.pinata_service import pinata_service
            return pinata_service.pin_file_bytes(data)
    
    def pin(self, cid: str) -> bool:
        """Pin content."""
        if self.client and not self.pinata_only:
            try:
                self.client.pin.add(cid)
                print(f"📌 Pinned locally: {cid}")
                return True
            except:
                pass
        
        # Pin to Pinata
        from services.pinata_service import pinata_service
        return pinata_service.pin_by_cid(cid)
    
    def get_url(self, cid: str) -> str:
        """Get public URL for content."""
        return f"{settings.IPFS_GATEWAY_URL}{cid}"


# Global instance
ipfs_service = IPFSService()