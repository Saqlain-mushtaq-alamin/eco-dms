"""
Configuration management for decentralized backend.
Loads environment variables for IPFS and Pinata integration.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import field_validator


class Settings(BaseSettings):
    """
    Application settings loaded from .env file.
    No more database URLs - we're using IPFS for storage!
    """

    # Added missing fields so .env keys are recognized
    APP_ENV: str = "dev"
    SECRET_KEY: str = "change_me_dev_long_random"
    SESSION_COOKIE_NAME: str = "eco_dms_session"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    MOBILE_ORIGIN: str = "exp://127.0.0.1:8081"

    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Eco-DMS Decentralized"

    # IPFS Configuration
    IPFS_API_URL: str = ""
    IPFS_GATEWAY_URL: str = "https://gateway.pinata.cloud/ipfs/"

    # Pinata
    PINATA_API_KEY: str = ""
    PINATA_SECRET_KEY: str = ""
    PINATA_JWT: str = ""

    # JWT Configuration
    JWT_SECRET_KEY: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    # CORS
    ALLOWED_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # Chain ID
    CHAIN_ID: int = 1

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # ignore any remaining unexpected env vars
    )

    @field_validator('ALLOWED_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith('[') and v.endswith(']'):
                import json
                try:
                    return json.loads(v)
                except:
                    v = v[1:-1]
            if ',' in v:
                return [origin.strip().strip('"').strip("'") for origin in v.split(',')]
            return [v] if v else []
        return v


# Global settings instance
settings = Settings()

"""
Authentication routes using SIWE (Sign-In with Ethereum).
No passwords, no database - just wallet signatures!
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from eth_account import Account
from eth_account.messages import encode_defunct
from app.config import settings
from app.services.ipfs_service import ipfs_service
import time

router = APIRouter()

_nonce_store: dict[str, dict] = {}
_user_profiles: dict[str, str] = {}

NONCE_TTL = 300
SESSION_TTL = 3600


class NonceResponse(BaseModel):
    address: str
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


class AuthResponse(BaseModel):
    address: str
    profile_cid: str | None
    token: str


def _generate_nonce() -> str:
    return Account.create().address[2:10]


@router.post("/auth/nonce", response_model=NonceResponse)
def get_nonce(address: str):
    address_lc = address.lower()
    nonce = _generate_nonce()
    expires = int(time.time()) + NONCE_TTL
    _nonce_store[address_lc] = {"nonce": nonce, "expires": expires}
    return NonceResponse(address=address_lc, nonce=nonce, expires_at=expires)


@router.post("/auth/prepare", response_model=PrepareMessageResponse)
def prepare(req: PrepareMessageRequest):
    entry = _nonce_store.get(req.address.lower())
    if not entry or entry["nonce"] != req.nonce or entry["expires"] < time.time():
        raise HTTPException(400, "Invalid or expired nonce")
    message = f"Sign in to Eco-DMS:\nAddress: {req.address.lower()}\nNonce: {req.nonce}\nExpires: {entry['expires']}"
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
    address_lc = req.address.lower()
    entry = _nonce_store.get(address_lc)
    if not entry or entry["nonce"] != req.nonce or entry["expires"] < time.time():
        raise HTTPException(400, "Invalid or expired nonce")

    message = f"Sign in to Eco-DMS:\nAddress: {address_lc}\nNonce: {req.nonce}\nExpires: {entry['expires']}"
    if not _verify_sig(address_lc, message, req.signature):
        raise HTTPException(401, "Signature invalid")

    import jwt, time as _t
    payload = {"sub": address_lc, "exp": int(_t.time()) + SESSION_TTL, "iat": int(_t.time())}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    profile_cid = _user_profiles.get(address_lc)
    return AuthResponse(address=address_lc, profile_cid=profile_cid, token=token)

# NEW: JWT decode helper + dependency
def _decode_jwt(token: str) -> dict:
    import jwt
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