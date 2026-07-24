"""
Authentication routes using SIWE (Sign-In with Ethereum).
No passwords, no database - just wallet signatures!
Uses Redis for nonces, profile CID cache, and simple rate limiting.
"""
from fastapi import APIRouter, HTTPException, Header, Request, Depends
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from eth_account import Account
from eth_account.messages import encode_defunct
from backend.app.config import settings
from backend.app.services.pinata_service import pinata_service
from backend.app.services.redis_service import redis_service
from backend.app.services.ipfs_service import ipfs_service
import time
import secrets
import re
import logging
import jwt
from datetime import datetime, timedelta

# Routers
router = APIRouter()
siwe_router = APIRouter()
siwe_alias_router = APIRouter()

# TTLs
NONCE_TTL = settings.NONCE_TTL_SECONDS
SESSION_TTL = settings.SESSION_TTL_SECONDS

# ------------- Models ------------

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

class SiweVerifyRequest(BaseModel):
    message: str  # make required for alias verify, or use a second model for alias
    signature: str
    address: str | None = None
    nonce: str | None = None

class AuthResponse(BaseModel):
    address: str
    profile_cid: str | None = None
    token: str

# ------------- Helpers ------------

def _rl(key: str, limit: int, window: int):
    if redis_service.incr(key, ex=window) > limit:
        raise HTTPException(status_code=429, detail="Too many requests")

def _nonce_key(nonce: str) -> str:
    return f"siwe:nonce:{nonce}"

def _profile_cid_key(address: str) -> str:
    return f"user:profile:cid:{address.lower()}"

def _generate_nonce() -> str:
    # 16 hex chars (8 bytes); short but sufficient for login nonces
    return secrets.token_hex(8)

def _parse_prepared_message(message: str) -> tuple[str | None, str | None, int | None]:
    addr = None
    nonce = None
    expires = None
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

def _verify_sig(address: str, message: str, signature: str) -> bool:
    encoded = encode_defunct(text=message)
    try:
        recovered = Account.recover_message(encoded, signature=signature).lower()
        return recovered == address.lower()
    except Exception:
        return False

def _encode_jwt(wallet_address: str) -> str:
    """Create JWT token for authenticated user."""
    payload = {
        "sub": wallet_address,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token

def _decode_jwt(token: str) -> dict:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(authorization: str | None = Header(default=None)) -> str:
    """
    Extract wallet address from Bearer token in Authorization header.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        token = authorization.replace("Bearer ", "")
        payload = _decode_jwt(token)
        wallet_address = payload.get("sub")
        if not wallet_address:
            raise HTTPException(status_code=401, detail="No wallet address in token")
        return wallet_address
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")

# Alias — some modules import require_authenticated instead of get_current_user
require_authenticated = get_current_user


# ---------------- Legacy endpoints (/auth/...) ----------------

@router.post("/auth/nonce", response_model=NonceResponse)
def legacy_get_nonce(address: str, request: Request):
    ip = request.client.host if request.client else "unknown"
    _rl(f"rl:nonce:{ip}", settings.RATE_LIMIT_MAX_NONCE, settings.RATE_LIMIT_WINDOW_SEC)
    nonce = _generate_nonce()
    expires = int(time.time()) + NONCE_TTL
    redis_service.set_str(_nonce_key(nonce), "1", ex=NONCE_TTL)
    return NonceResponse(address=address.lower(), nonce=nonce, expires_at=expires)

@router.post("/auth/prepare", response_model=PrepareMessageResponse)
def legacy_prepare(req: PrepareMessageRequest):
    if not redis_service.get_str(_nonce_key(req.nonce)):
        raise HTTPException(400, "Invalid or expired nonce")
    expires = int(time.time()) + NONCE_TTL
    message = f"Sign in to Eco-DMS:\nAddress: {req.address.lower()}\nNonce: {req.nonce}\nExpires: {expires}"
    return PrepareMessageResponse(message=message)

@router.post("/auth/verify", response_model=AuthResponse)
def legacy_verify(req: VerifyRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    _rl(f"rl:verify:{ip}", settings.RATE_LIMIT_MAX_VERIFY, settings.RATE_LIMIT_WINDOW_SEC)

    address_lc = req.address.lower()
    if not redis_service.get_str(_nonce_key(req.nonce)):
        raise HTTPException(400, "Invalid or expired nonce")

    expires = int(time.time()) + NONCE_TTL
    message = f"Sign in to Eco-DMS:\nAddress: {address_lc}\nNonce: {req.nonce}\nExpires: {expires}"

    if not _verify_sig(address_lc, message, req.signature):
        raise HTTPException(401, "Signature invalid")

    # consume nonce
    redis_service.delete(_nonce_key(req.nonce))

    payload = {"sub": address_lc, "exp": int(time.time()) + SESSION_TTL, "iat": int(time.time())}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    profile_cid = redis_service.get_str(_profile_cid_key(address_lc))
    return AuthResponse(address=address_lc, profile_cid=profile_cid, token=token)

# ---------------- SIWE endpoints (/siwe/...) ----------------

@siwe_router.get("/nonce", response_model=SiweNonceResponse)
def siwe_nonce(request: Request):
    ip = request.client.host if request.client else "unknown"
    _rl(f"rl:nonce:{ip}", settings.RATE_LIMIT_MAX_NONCE, settings.RATE_LIMIT_WINDOW_SEC)
    nonce = _generate_nonce()
    expires = int(time.time()) + NONCE_TTL
    redis_service.set_str(_nonce_key(nonce), "1", ex=NONCE_TTL)
    return SiweNonceResponse(nonce=nonce, expires_at=expires)

@siwe_router.post("/prepare", response_model=PrepareMessageResponse)
def siwe_prepare(req: PrepareMessageRequest):
    if not redis_service.get_str(_nonce_key(req.nonce)):
        raise HTTPException(400, "Invalid or expired nonce")
    expires = int(time.time()) + NONCE_TTL
    message = f"Sign in to Eco-DMS:\nAddress: {req.address.lower()}\nNonce: {req.nonce}\nExpires: {expires}"
    return PrepareMessageResponse(message=message)

@siwe_router.post("/verify", response_model=AuthResponse)
def siwe_verify(req: SiweVerifyRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    _rl(f"rl:verify:{ip}", settings.RATE_LIMIT_MAX_VERIFY, settings.RATE_LIMIT_WINDOW_SEC)

    if req.message:
        parsed_addr, nonce, parsed_exp = _parse_prepared_message(req.message)
        if not parsed_addr or not nonce:
            raise HTTPException(400, "Invalid message format")
        address_lc = parsed_addr
        message = req.message
    else:
        if not (req.address and req.nonce):
            raise HTTPException(422, "address and nonce required when message is not provided")
        address_lc = req.address.lower()
        nonce = req.nonce
        expires = int(time.time()) + NONCE_TTL
        message = f"Sign in to Eco-DMS:\nAddress: {address_lc}\nNonce: {nonce}\nExpires: {expires}"

    if not redis_service.get_str(_nonce_key(nonce)):
        raise HTTPException(400, "Invalid or expired nonce")

    if not _verify_sig(address_lc, message, req.signature):
        raise HTTPException(401, "Signature invalid")

    # consume nonce
    redis_service.delete(_nonce_key(nonce))

    payload = {"sub": address_lc, "exp": int(time.time()) + SESSION_TTL, "iat": int(time.time())}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    profile_cid = redis_service.get_str(_profile_cid_key(address_lc))
    return AuthResponse(address=address_lc, profile_cid=profile_cid, token=token)

@siwe_router.post("/logout")
def siwe_logout(authorization: str | None = Header(default=None)):
    # Stateless logout: client should delete token. Add JWT blacklist if needed.
    return {"ok": True}

# Absolute-path aliases to match /api/siwe/... directly
@siwe_alias_router.get("/api/siwe/nonce", response_model=SiweNonceResponse)
def siwe_nonce_alias(request: Request):
    return siwe_nonce(request)

@siwe_alias_router.post("/api/siwe/prepare", response_model=PrepareMessageResponse)
def siwe_prepare_alias(req: PrepareMessageRequest):
    return siwe_prepare(req)

@siwe_alias_router.post("/api/siwe/verify", response_model=AuthResponse)
async def verify_signature_alias(req: SiweVerifyRequest):
    """Verify SIWE signature and return JWT token."""
    # print(f"DEBUG: verify endpoint called")
    # print(f"DEBUG: message: {req.message}")
    # print(f"DEBUG: signature: {req.signature[:20]}...")
    
    try:
        if not req.message:
            # If message not provided, build it from address/nonce or return 400
            if not (req.address and req.nonce):
                raise HTTPException(status_code=400, detail="Missing message or address/nonce")
            expires = int(time.time()) + NONCE_TTL
            req.message = f"Sign in to Eco-DMS:\nAddress: {req.address.lower()}\nNonce: {req.nonce}\nExpires: {expires}"

        assert isinstance(req.message, str)
        message = encode_defunct(text=req.message)  # req.message is guaranteed str now
        recovered_address = Account.recover_message(message, signature=req.signature)
        
        # print(f"DEBUG: Recovered address: {recovered_address}")
        
        # Create JWT token
        jwt_token = _encode_jwt(recovered_address)
        
        # print(f"DEBUG: JWT token created")
        
        return AuthResponse(
            address=recovered_address,
            profile_cid=None,
            token=jwt_token
        )
    except Exception as e:
        # print(f"DEBUG: Verification failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))

@siwe_alias_router.post("/api/siwe/logout")
def siwe_logout_alias(authorization: str | None = Header(default=None)):
    return siwe_logout(authorization)

# ---------------- Minimal profile endpoints (CID cache) ----------------

@router.post("/profile")
def set_profile(address: str, profile: dict):
    cid = ipfs_service.add_json(profile)
    if not cid:
        raise HTTPException(500, "IPFS store failed")
    redis_service.set_str(_profile_cid_key(address), cid, ex=24 * 3600)
    return {"address": address.lower(), "profile_cid": cid, "url": ipfs_service.get_url(cid)}

@router.get("/profile/{address}")
def get_profile(address: str):
    cid = redis_service.get_str(_profile_cid_key(address))
    if not cid:
        raise HTTPException(404, "Not found")
    data = ipfs_service.get_json(cid)
    return {"cid": cid, "data": data}


# ! this code is for development/testing purposes only !___________________and it remove all cached CIDs and pins

# >>> DEV-ONLY: Full reset (Redis flush + Pinata unpin-all + IPFS unpin-all & GC)
@router.post("/dev/cleanup")
def dev_cleanup():
    result: dict[str, dict | None] = {"redis": None, "pinata": None, "ipfs": None}
    print("💥DEV CLEANUP: Starting cleanup of Redis, Pinata, and IPFS local...")
    # Redis
    try:
        if getattr(redis_service, "client", None):
            redis_service.client.flushdb()
            result["redis"] = {"ok": True}
        else:
            result["redis"] = {"ok": False, "error": "Redis not connected"}
    except Exception as e:
        result["redis"] = {"ok": False, "error": str(e)}
    # Pinata
    try:
        result["pinata"] = pinata_service.unpin_all()
    except Exception as e:
        result["pinata"] = {"ok": False, "error": str(e)}
    # IPFS local
    try:
        result["ipfs"] = ipfs_service.dev_unpin_all_and_gc()
    except Exception as e:
        result["ipfs"] = {"ok": False, "error": str(e)}
    # Summarize
    ok = all(v and v.get("ok") for v in result.values() if v is not None)
    if not ok:
        # Return 200 with detail so you can inspect which part failed in dev
        return {"ok": False, "detail": result}
    return {"ok": True, "detail": result}
# <<< DEV-ONLY