"""
IPFS Service with Pinata fallback.
Works even without a local IPFS node.
"""
import os
import sys
import json
import time
from typing import Dict, Any, Optional, List
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
        
        # Multiple gateway fallbacks to handle rate limiting
        self.gateway_urls: List[str] = [
            self.gateway_url,
            "https://ipfs.io/ipfs/",
            "https://dweb.link/ipfs/",
            "https://cloudflare-ipfs.com/ipfs/",
            "https://gateway.ipfs.io/ipfs/"
        ]
        # Remove duplicates while preserving order
        seen = set()
        self.gateway_urls = [x for x in self.gateway_urls if not (x in seen or seen.add(x))]

        if self.api_url:
            try:
                # Kubo exposes a root-level /version endpoint (plain text, no auth
                # required even in Kubo 0.27+ security mode) that we use for the
                # startup connectivity check.  The actual RPC calls go through
                # api_url which should include /api/v0.
                _ping_base = self.api_url.rstrip('/')
                if _ping_base.endswith('/api/v0'):
                    _ping_base = _ping_base[:-7]  # strip /api/v0 for the ping

                r = requests.post(f"{_ping_base}/version", timeout=3)
                if r.ok:
                    # Response may be JSON ({"Version": "0.39.0", ...}) or
                    # plain text ("Client Version: kubo/0.39.0/...") depending
                    # on Kubo version — handle both without crashing.
                    try:
                        ver = r.json().get("Version", "?")
                    except Exception:
                        ver = r.text.split("kubo/")[1].split("/")[0] if "kubo/" in r.text else "?"
                    self.client = True
                    print(f"✅ Connected to IPFS (kubo/{ver}) at {self.api_url}")
                else:
                    self.pinata_only = True
                    print(f"⚠️ IPFS API not responding (HTTP {r.status_code}), falling back to Pinata")
            except Exception as exc:
                self.pinata_only = True
                print(f"⚠️ Could not connect to IPFS API ({exc}), falling back to Pinata")
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
        """Get JSON from IPFS with retry logic and multiple gateway fallbacks."""
        max_retries = 3
        base_delay = 1  # seconds
        
        # Try each gateway
        for gateway_url in self.gateway_urls:
            url = f"{gateway_url.rstrip('/')}/{cid}"
            
            # Retry with exponential backoff for each gateway
            for attempt in range(max_retries):
                try:
                    r = requests.get(url, timeout=20)
                    
                    # If rate limited, try next gateway immediately
                    if r.status_code == 429:
                        print(f"⚠️ Rate limited on {gateway_url}, trying next gateway...")
                        break
                    
                    r.raise_for_status()
                    return r.json()
                    
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 429:
                        # Rate limited - don't retry on this gateway
                        break
                    elif attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        print(f"⚠️ Attempt {attempt + 1} failed for {url}, retrying in {delay}s...")
                        time.sleep(delay)
                    else:
                        print(f"⚠️ All retries failed for gateway {gateway_url}: {e}")
                except Exception as e:
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        time.sleep(delay)
                    else:
                        print(f"⚠️ Gateway {gateway_url} failed: {e}")
                        break
        
        print(f"❌ get_json failed for CID {cid} on all gateways")
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
