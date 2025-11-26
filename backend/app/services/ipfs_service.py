"""
IPFS Service with Pinata fallback.
Works even without a local IPFS node.
"""
import json
from typing import Dict, Any, Optional
import sys
import os

# Add root path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings


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
            try:
                import ipfshttpclient
                self.client = ipfshttpclient.connect(settings.IPFS_API_URL)
                print(f"✅ Connected to IPFS at {settings.IPFS_API_URL}")
            except Exception as e:
                print(f"⚠️ IPFS connection failed: {e}")
                print("➡️ Falling back to Pinata-only mode")
                self.pinata_only = True
        else:
            print("📌 Pinata-only mode enabled (no IPFS_API_URL)")
            self.pinata_only = True

    # ----------------------------------------------------------------------
    # Add JSON
    # ----------------------------------------------------------------------
    def add_json(self, data: Dict[str, Any]) -> Optional[str]:
        """Add JSON to IPFS or Pinata."""
        if self.client and not self.pinata_only:
            try:
                # ipfshttpclient supports add_json()
                result = self.client.add_json(data)  # type: ignore
                print(f"✅ Added JSON to IPFS: {result}")
                return result
            except Exception as e:
                print(f"❌ IPFS add_json failed: {e}")

        # Pinata fallback
        from app.services.pinata_service import pinata_service
        cid = pinata_service.pin_json(data)
        return cid

    # ----------------------------------------------------------------------
    # Get JSON
    # ----------------------------------------------------------------------
    def get_json(self, cid: str) -> Optional[Dict[str, Any]]:
        """Get JSON from IPFS or fallback gateway."""
        if self.client and not self.pinata_only:
            try:
                result = self.client.cat(cid)  # type: ignore
                return json.loads(result)
            except Exception as e:
                print(f"⚠️ Local IPFS get failed: {e}")

        # Fallback: public gateway fetch
        try:
            import requests
            url = f"{settings.IPFS_GATEWAY_URL}{cid}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ Gateway fetch failed: {e}")
            return None

    # ----------------------------------------------------------------------
    # Add Bytes
    # ----------------------------------------------------------------------
    def add_bytes(self, data: bytes) -> Optional[str]:
        """Add raw bytes to IPFS or Pinata."""
        if self.client and not self.pinata_only:
            try:
                result = self.client.add_bytes(data)  # type: ignore
                print(f"✅ Bytes added to IPFS: {result}")
                return result
            except Exception as e:
                print(f"❌ IPFS add_bytes failed: {e}")

        # Pinata fallback
        from app.services.pinata_service import pinata_service
        return pinata_service.pin_file_bytes(data)

    # ----------------------------------------------------------------------
    # Pin
    # ----------------------------------------------------------------------
    def pin(self, cid: str) -> bool:
        """Pin content locally or to Pinata."""
        if self.client and not self.pinata_only:
            try:
                # ipfshttpclient exposes "pin" dynamically, Pylance can't see it → use getattr
                pin_api = getattr(self.client, "pin", None)  # type: ignore

                if pin_api:
                    pin_api.add(cid)  # type: ignore
                    print(f"📌 Pinned locally: {cid}")
                    return True
                else:
                    print("⚠️ IPFS pin API not available (unexpected)")

            except Exception as e:
                print(f"❌ Local IPFS pin failed: {e}")

        # Pinata fallback
        from app.services.pinata_service import pinata_service
        return pinata_service.pin_by_cid(cid)

    # ----------------------------------------------------------------------
    # URL helper
    # ----------------------------------------------------------------------
    def get_url(self, cid: str) -> str:
        """Return public URL for a CID."""
        return f"{settings.IPFS_GATEWAY_URL}{cid}"


# Export global instance
ipfs_service = IPFSService()
