# In-memory nonce + session store for demo (replace with Redis/DB in prod)
import time
import secrets
from typing import Dict, Optional

class NonceStore:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self._data: Dict[str, float] = {}

    def create_nonce(self) -> str:
        nonce = secrets.token_hex(12)
        self._data[nonce] = time.time()
        return nonce

    def validate_and_consume(self, nonce: str) -> bool:
        ts = self._data.get(nonce)
        if ts is None:
            return False
        if time.time() - ts > self.ttl:
            self._data.pop(nonce, None)
            return False
        # One-time use
        self._data.pop(nonce, None)
        return True

class SessionStore:
    def __init__(self, ttl_seconds: int = 3600):
        self.ttl = ttl_seconds
        self._sessions: Dict[str, dict] = {}

    def create_session(self, address: str) -> str:
        sid = secrets.token_urlsafe(32)
        self._sessions[sid] = {
            "address": address.lower(),
            "created": time.time()
        }
        return sid

    def get_session(self, sid: str) -> Optional[dict]:
        data = self._sessions.get(sid)
        if not data:
            return None
        if time.time() - data["created"] > self.ttl:
            self._sessions.pop(sid, None)
            return None
        return data

    def destroy(self, sid: str):
        self._sessions.pop(sid, None)

nonce_store = NonceStore()
session_store = SessionStore()