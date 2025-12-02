"""
IPFS Service with Pinata fallback.
Works even without a local IPFS node.
"""
import os
import sys
import json
from typing import Dict, Any, Optional
import requests

# Add root path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.config import settings


class IPFSService:
    """
    IPFS service with Pinata-only mode support.
    If no local IPFS, falls back to Pinata API.
    """

    def __init__(self):
        """Initialize IPFS or Pinata-only mode."""
        self.client = None  # bool flag: IPFS API reachable
        self.pinata_only = False
        self.api_url = (settings.IPFS_API_URL or "").strip().rstrip("/")
        self.gateway_url = (settings.IPFS_GATEWAY_URL or "https://ipfs.io/ipfs/").strip().rstrip("/") + "/"

        if self.api_url:
            try:
                # Simple ping
                r = requests.post(f"{self.api_url}/version", timeout=2)
                if r.ok:
                    ver = r.json().get("Version", "unknown")
                    self.client = True
                    print(f"✅ Connected to IPFS API ({ver}) at {self.api_url}")
                else:
                    self.pinata_only = True
                    print("⚠️ IPFS API not responding, falling back to Pinata")
            except Exception:
                self.pinata_only = True
                print("⚠️ Could not connect to IPFS API, falling back to Pinata")
        else:
            self.pinata_only = True
            print("📌 Pinata-only mode enabled (no IPFS_API_URL)")

    # ----------------------------------------------------------------------
    # Add JSON
    # ----------------------------------------------------------------------
    def add_json(self, data: Dict[str, Any]) -> Optional[str]:
        """Add JSON to IPFS or Pinata."""
        if self.client and not self.pinata_only:
            try:
                payload = json.dumps(data).encode("utf-8")
                files = {"file": ("data.json", payload, "application/json")}
                r = requests.post(f"{self.api_url}/add?pin=true&wrap-with-directory=false", files=files, timeout=30)
                r.raise_for_status()
                # ipfs add returns NDJSON; take the last line's Hash
                last = r.text.strip().splitlines()[-1]
                obj = json.loads(last)
                return obj.get("Hash")
            except Exception as e:
                print(f"⚠️ IPFS add_json failed: {e}. Falling back to Pinata.")

        # Pinata fallback
        try:
            from backend.app.services.pinata_service import pinata_service
            return pinata_service.pin_json(data)
        except Exception as e:
            print(f"❌ Pinata add_json failed: {e}")
            return None

    # ----------------------------------------------------------------------
    # Get JSON
    # ----------------------------------------------------------------------
    def get_json(self, cid: str) -> Optional[Dict[str, Any]]:
        """Get JSON from IPFS or fallback gateway."""
        # Always use gateway for reads (works for both local and pinned)
        try:
            url = self.get_url(cid)
            r = requests.get(url, timeout=20)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"⚠️ get_json failed from gateway: {e}")
            return None

    # ----------------------------------------------------------------------
    # Add Bytes
    # ----------------------------------------------------------------------
    def add_bytes(self, data: bytes, filename: str = "file.bin", mime: str = "application/octet-stream") -> Optional[str]:
        """Add raw bytes to IPFS or Pinata."""
        if self.client and not self.pinata_only:
            try:
                files = {"file": (filename, data, mime)}
                r = requests.post(f"{self.api_url}/add?pin=true&wrap-with-directory=false", files=files, timeout=60)
                r.raise_for_status()
                last = r.text.strip().splitlines()[-1]
                obj = json.loads(last)
                return obj.get("Hash")
            except Exception as e:
                print(f"⚠️ IPFS add_bytes failed: {e}. Falling back to Pinata.")

        # Pinata fallback
        try:
            from backend.app.services.pinata_service import pinata_service
            return pinata_service.pin_file_bytes(data, filename=filename)
        except Exception as e:
            print(f"❌ Pinata add_bytes failed: {e}")
            return None

    # ----------------------------------------------------------------------
    # Pin
    # ----------------------------------------------------------------------
    def pin(self, cid: str) -> bool:
        """Pin an existing CID on IPFS or via Pinata."""
        if self.client and not self.pinata_only:
            try:
                r = requests.post(f"{self.api_url}/pin/add?arg={cid}", timeout=15)
                return r.ok
            except Exception as e:
                print(f"⚠️ IPFS pin failed: {e}. Falling back to Pinata.")

        try:
            from backend.app.services.pinata_service import pinata_service
            return pinata_service.pin_by_cid(cid)
        except Exception as e:
            print(f"❌ Pinata pin_by_cid failed: {e}")
            return False

    # ----------------------------------------------------------------------
    # URL helper
    # ----------------------------------------------------------------------
    def get_url(self, cid: str) -> str:
        return f"{self.gateway_url}{cid}"

    # ! >>> DEV-ONLY: Remove all local pins and run repo GC
    def dev_unpin_all_and_gc(self) -> dict:
        if not self.client or self.pinata_only or not self.api_url:
            return {"ok": False, "error": "IPFS API not connected"}
        try:
            # list pins
            ls = requests.post(f"{self.api_url}/pin/ls", timeout=20)
            if not ls.ok:
                return {"ok": False, "error": f"pin/ls {ls.status_code}"}
            rows = ls.json().get("Keys", {}) or {}
            removed = 0
            for cid in list(rows.keys()):
                rm = requests.post(f"{self.api_url}/pin/rm?arg={cid}", timeout=20)
                if rm.ok:
                    removed += 1
            gc = requests.post(f"{self.api_url}/repo/gc", timeout=60)
            return {"ok": True, "removed": removed, "gc_status": gc.status_code}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    # <<< DEV-ONLY


# Export global instance
ipfs_service = IPFSService()
