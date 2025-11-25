"""
IPFS Service - handles all IPFS interactions.
Replaces traditional database with distributed storage.
"""
import ipfshttpclient
import json
from typing import Dict, Any, Optional, cast
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings


class IPFSService:
    """
    Manages IPFS connections and operations.
    Stores all data (users, documents) as JSON in IPFS.
    """
    
    def __init__(self):
        """Connect to IPFS daemon."""
        try:
            self.client = ipfshttpclient.connect(settings.IPFS_API_URL)
            print(f"✅ Connected to IPFS at {settings.IPFS_API_URL}")
        except Exception as e:
            print(f"⚠️ IPFS connection failed: {e}")
            print("💡 Make sure IPFS daemon is running: ipfs daemon")
            self.client = None
    
    def add_json(self, data: Dict[str, Any]) -> Optional[str]:
        """
        Add JSON data to IPFS.
        
        Args:
            data: Dictionary to store
            
        Returns:
            CID (Content Identifier) - like "QmXyz123..."
            
        Example:
            user_data = {"wallet": "0x123...", "username": "alice"}
            cid = ipfs.add_json(user_data)
            # Returns: "QmAbc123..."
        """
        if not self.client:
            print("❌ IPFS not connected")
            return None
        
        try:
            result = self.client.add_json(data)
            print(f"✅ Added to IPFS: {result}")
            return result
        except Exception as e:
            print(f"❌ Failed to add to IPFS: {e}")
            return None
    
    def get_json(self, cid: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve JSON data from IPFS.
        
        Args:
            cid: Content identifier
            
        Returns:
            Dictionary containing the data
            
        Example:
            data = ipfs.get_json("QmAbc123...")
            # Returns: {"wallet": "0x123...", "username": "alice"}
        """
        if not self.client:
            print("❌ IPFS not connected")
            return None
        
        try:
            # Use bytes API to avoid streamed iterator types and parse JSON manually
            raw = self.client.cat(cid)
            if not isinstance(raw, (bytes, bytearray)):
                # Some versions may return an iterator of byte chunks
                raw = b"".join(chunk for chunk in raw)
            obj = json.loads(raw.decode("utf-8"))
            if isinstance(obj, dict):
                return obj
            else:
                print("❌ IPFS content is not a JSON object")
                return None
        except Exception as e:
            print(f"❌ Failed to get from IPFS: {e}")
            return None
    
    def add_bytes(self, data: bytes) -> Optional[str]:
        """
        Add raw bytes (file upload) to IPFS.
        
        Args:
            data: File bytes
            
        Returns:
            CID of uploaded file
        """
        if not self.client:
            return None
        
        try:
            result = self.client.add_bytes(data)
            print(f"✅ File added to IPFS: {result}")
            return result
        except Exception as e:
            print(f"❌ Failed to add file: {e}")
            return None
    
    def pin(self, cid: str) -> bool:
        """
        Pin content to prevent garbage collection.
        
        Args:
            cid: Content to pin
            
        Returns:
            True if successful
        """
        if not self.client:
            return False
        
        try:
            cast(Any, self.client).pin.add(cid)
            print(f"📌 Pinned: {cid}")
            return True
        except Exception as e:
            print(f"❌ Pin failed: {e}")
            return False
    
    def get_url(self, cid: str) -> str:
        """
        Get public gateway URL for content.
        
        Args:
            cid: Content identifier
            
        Returns:
            Public URL like "https://ipfs.io/ipfs/QmXyz..."
        """
        return f"{settings.IPFS_GATEWAY_URL}{cid}"


# Global IPFS service instance
ipfs_service = IPFSService()