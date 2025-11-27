"""
Authentication routes using SIWE (Sign-In with Ethereum).
No passwords, no database - just wallet signatures!
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from eth_account import Account
from eth_account.messages import encode_defunct
from backend.app.config import settings
from backend.app.services.ipfs_service import ipfs_service
import time
import re
import jwt

# Main router (legacy /auth routes will remain)
router = APIRouter()
siwe_router = APIRouter()
siwe_alias_router = APIRouter()

_nonce_index: dict[str, int] = {}
_nonce_store: dict[str, dict] = {}
_user_profiles: dict[str, str] = {}

NONCE_TTL = 300
SESSION_TTL = 3600

class NonceResponse(BaseModel):
    address: str
    nonce: str
    expires_at: int

class SiweNonceResponse(BaseModel):
    nonce: str
    expires_at: int

class PrepareMessageRequest(BaseModel):
    address: str
    nonce: str

class PrepareMessageResponse(BaseModel):
    message: str

class VerifyRequest(BaseModel):
    address: str
    signature: str
    nonce: str

# NEW: Accept SIWE style body too
class SiweVerifyRequest(BaseModel):
    message: str | None = None
    signature: str
    address: str | None = None
    nonce: str | None = None

class AuthResponse(BaseModel):
    address: str
    profile_cid: str | None
    token: str

def _generate_nonce() -> str:
    return Account.create().address[2:10]

def _parse_prepared_message(message: str) -> tuple[str | None, str | None, int | None]:
    """
    Parse our prepared message:
      Sign in to Eco-DMS:
      Address: 0xabc...
      Nonce: 12345678
      Expires: 1700000000
    """
    addr = None
    nonce = None
    expires = None
    # Robust parsing
    m_addr = re.search(r"Address:\s*(0x[a-fA-F0-9]{40})", message)
    if m_addr:
        addr = m_addr.group(1).lower()
    m_nonce = re.search(r"Nonce:\s*([A-Za-z0-9]+)", message)
    if m_nonce:
        nonce = m_nonce.group(1)
    m_exp = re.search(r"Expires:\s*(\d+)", message)
    if m_exp:
        try:
            expires = int(m_exp.group(1))
        except ValueError:
            expires = None
    return addr, nonce, expires

# ---------------- Legacy endpoints (/auth/...) ----------------

@router.post("/auth/nonce", response_model=NonceResponse)
def get_nonce(address: str):
    address_lc = address.lower()
    nonce = _generate_nonce()
    expires = int(time.time()) + NONCE_TTL
    _nonce_store[address_lc] = {"nonce": nonce, "expires": expires}
    _nonce_index[nonce] = expires
    return NonceResponse(address=address_lc, nonce=nonce, expires_at=expires)

@router.post("/auth/prepare", response_model=PrepareMessageResponse)
def prepare(req: PrepareMessageRequest):
    now = int(time.time())
    entry = _nonce_store.get(req.address.lower())
    expires = None
    if entry and entry["nonce"] == req.nonce:
        expires = entry["expires"]
    elif req.nonce in _nonce_index:
        expires = _nonce_index[req.nonce]
    if not expires or expires < now:
        raise HTTPException(400, "Invalid or expired nonce")
    message = f"Sign in to Eco-DMS:\nAddress: {req.address.lower()}\nNonce: {req.nonce}\nExpires: {expires}"
    return PrepareMessageResponse(message=message)

def _verify_sig(address: str, message: str, signature: str) -> bool:
    encoded = encode_defunct(text=message)
    try:
        recovered = Account.recover_message(encoded, signature=signature).lower()
        return recovered == address.lower()
    except Exception:
        return False

@router.post("/auth/verify", response_model=AuthResponse)
def verify(req: VerifyRequest):
    # Reuse SIWE verify with normalized shape
    return siwe_verify(SiweVerifyRequest(address=req.address, nonce=req.nonce, signature=req.signature))

# ---------------- SIWE endpoints (/siwe/...) ----------------

@siwe_router.get("/nonce", response_model=SiweNonceResponse)
def siwe_nonce():
    nonce = _generate_nonce()
    expires = int(time.time()) + NONCE_TTL
    _nonce_index[nonce] = expires
    return SiweNonceResponse(nonce=nonce, expires_at=expires)

@siwe_router.post("/prepare", response_model=PrepareMessageResponse)
def siwe_prepare(req: PrepareMessageRequest):
    now = int(time.time())
    expires = _nonce_index.get(req.nonce)
    if not expires or expires < now:
        raise HTTPException(400, "Invalid or expired nonce")
    message = f"Sign in to Eco-DMS:\nAddress: {req.address.lower()}\nNonce: {req.nonce}\nExpires: {expires}"
    return PrepareMessageResponse(message=message)

@siwe_router.post("/verify", response_model=AuthResponse)
def siwe_verify(req: SiweVerifyRequest):
    # Accept either {message, signature} or {address, nonce, signature}
    if req.message:
        parsed_addr, parsed_nonce, parsed_exp = _parse_prepared_message(req.message)
        if not parsed_addr or not parsed_nonce:
            raise HTTPException(400, "Invalid message format")
        address_lc = parsed_addr
        nonce = parsed_nonce
        # Check nonce validity
        now = int(time.time())
        expires = _nonce_index.get(nonce, parsed_exp)
        if not expires or expires < now:
            raise HTTPException(400, "Invalid or expired nonce")
        message = req.message
    else:
        if not (req.address and req.nonce):
            raise HTTPException(422, "address and nonce required when message is not provided")
        address_lc = req.address.lower()
        nonce = req.nonce
        now = int(time.time())
        expires = _nonce_index.get(nonce)
        if not expires or expires < now:
            entry = _nonce_store.get(address_lc)
            if not entry or entry.get("nonce") != nonce or entry.get("expires", 0) < now:
                raise HTTPException(400, "Invalid or expired nonce")
            expires = entry["expires"]
        message = f"Sign in to Eco-DMS:\nAddress: {address_lc}\nNonce: {nonce}\nExpires: {expires}"

    if not _verify_sig(address_lc, message, req.signature):
        raise HTTPException(401, "Signature invalid")
    # Consume nonce
    _nonce_index.pop(nonce, None)
    _nonce_store.pop(address_lc, None)

    payload = {"sub": address_lc, "exp": int(time.time()) + SESSION_TTL, "iat": int(time.time())}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    profile_cid = _user_profiles.get(address_lc)
    return AuthResponse(address=address_lc, profile_cid=profile_cid, token=token)

# NEW: SIWE logout (stateless - client should discard token)
@siwe_router.post("/logout")
def siwe_logout(authorization: str | None = Header(default=None)):
    # Optionally parse and blacklist JWT here; currently stateless.
    return {"ok": True, "message": "Logged out. Delete the client token."}

# Absolute-path aliases so it works even if main doesn’t set a prefix
@siwe_alias_router.get("/api/siwe/nonce", response_model=SiweNonceResponse)
def siwe_nonce_alias():
    return siwe_nonce()

@siwe_alias_router.post("/api/siwe/prepare", response_model=PrepareMessageResponse)
def siwe_prepare_alias(req: PrepareMessageRequest):
    return siwe_prepare(req)

@siwe_alias_router.post("/api/siwe/verify", response_model=AuthResponse)
def siwe_verify_alias(req: SiweVerifyRequest):
    return siwe_verify(req)

# NEW: alias for /api/siwe/logout
@siwe_alias_router.post("/api/siwe/logout")
def siwe_logout_alias(authorization: str | None = Header(default=None)):
    return siwe_logout(authorization)

# ---------------- Auth helpers ----------------

def _decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    raw = authorization[len("Bearer "):].strip()
    payload = _decode_jwt(raw)
    address = payload.get("sub")
    if not address:
        raise HTTPException(401, "Token missing subject")
    return {"address": address}

@router.post("/profile")
def set_profile(address: str, profile: dict):
    cid = ipfs_service.add_json(profile)
    if not cid:
        raise HTTPException(500, "IPFS store failed")
    _user_profiles[address.lower()] = cid
    return {"address": address.lower(), "profile_cid": cid, "url": ipfs_service.get_url(cid)}

@router.get("/profile/{address}")
def get_profile(address: str):
    cid = _user_profiles.get(address.lower())
    if not cid:
        raise HTTPException(404, "Not found")
    data = ipfs_service.get_json(cid)
    return {"cid": cid, "data": data}