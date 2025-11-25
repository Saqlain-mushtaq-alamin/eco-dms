"""
Authentication routes using SIWE (Sign-In with Ethereum).
No passwords, no database - just wallet signatures!
"""
from fastapi import APIRouter, HTTPException, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from siwe import SiweMessage
from datetime import datetime, timedelta
import secrets
from web3 import Web3
from eth_account.messages import encode_defunct

from .models import (
    NonceRequest,
    NonceResponse,
    VerifyRequest,
    TokenResponse,
    ProfileUpdateRequest,
    User
)
from .services.user_service import user_service
from .config import settings
from .siwe_store import nonce_store, session_store
from .session_middleware import set_session_cookie, clear_session_cookie

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()

# In-memory nonce storage
# Maps wallet_address -> {nonce, timestamp}
# In production, use Redis or on-chain storage
nonce_store = {}


def build_siwe_message(addr: str, chain_id: int, nonce: str) -> str:
    # Minimal SIWE message
    return (
        f"{addr.lower()} wants to sign in to {settings.DOMAIN}.\n\n"
        f"URI: {settings.URI}\nVersion: {settings.VERSION}\nChain ID: {chain_id}\nNonce: {nonce}"
    )


@router.post("/nonce", response_model=NonceResponse)
async def get_nonce(request: NonceRequest):
    """
    Step 1: Get nonce for SIWE authentication.

    Flow:
    1. Frontend requests nonce with wallet address
    2. Backend generates random nonce
    3. Frontend signs message with nonce using wallet
    4. Backend verifies signature in /verify endpoint

    Example request:
        POST /auth/nonce
        {"wallet_address": "0x1234..."}

    Example response:
        {
            "nonce": "abc123xyz789",
            "message": "Sign this message to authenticate with Eco-DMS\nNonce: abc123xyz789"
        }
    """
    wallet_address = request.wallet_address.lower()

    # Generate random nonce (prevents replay attacks)
    nonce = secrets.token_hex(16)

    # Store nonce with timestamp (expires after 5 minutes)
    nonce_store[wallet_address] = {
        "nonce": nonce,
        "timestamp": datetime.utcnow()
    }

    # Message for user to sign with their wallet
    message = f"Sign this message to authenticate with Eco-DMS\nNonce: {nonce}"

    return NonceResponse(nonce=nonce, message=message)


@router.post("/prepare", response_model=NonceResponse)
def prepare_message(payload: NonceRequest):
    if not Web3.is_address(payload.wallet_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    if not nonce_store.validate_and_consume(payload.nonce):
        raise HTTPException(status_code=400, detail="Invalid or expired nonce")
    message = build_siwe_message(payload.wallet_address, payload.chain_id, payload.nonce)
    return NonceResponse(nonce=payload.nonce, message=message)


@router.post("/verify", response_model=TokenResponse)
async def verify_signature(request: VerifyRequest):
    """
    Step 2: Verify wallet signature and issue JWT token.

    Flow:
    1. Verify nonce is valid and not expired
    2. Verify signature matches wallet address
    3. Create or get user profile from IPFS
    4. Issue JWT token for session management

    Example request:
        POST /auth/verify
        {
            "wallet_address": "0x1234...",
            "signature": "0xabcd...",
            "message": "Sign this message..."
        }

    Example response:
        {
            "access_token": "eyJhbGc...",
            "token_type": "bearer",
            "wallet_address": "0x1234..."
        }
    """
    wallet_address = request.wallet_address.lower()

    # Check if nonce exists
    if wallet_address not in nonce_store:
        raise HTTPException(status_code=400, detail="Nonce not found. Request a new nonce.")

    nonce_data = nonce_store[wallet_address]

    # Check nonce expiration (5 minutes)
    if (datetime.utcnow() - nonce_data["timestamp"]).total_seconds() > 300:
        del nonce_store[wallet_address]
        raise HTTPException(status_code=400, detail="Nonce expired. Request a new nonce.")

    try:
        # Parse SIWE message
        siwe_message = SiweMessage.from_message(request.message)

        # Verify signature
        siwe_message.verify(request.signature)

        # Verify wallet address matches
        if siwe_message.address.lower() != wallet_address:
            raise HTTPException(status_code=400, detail="Wallet address mismatch")

        # Delete used nonce (prevent replay attacks)
        del nonce_store[wallet_address]

        # Get or create user profile in IPFS
        profile, profile_cid = await user_service.get_or_create_profile(wallet_address)

        # Create JWT token
        token_data = {
            "sub": wallet_address,
            "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
        }

        access_token = jwt.encode(
            token_data,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            wallet_address=wallet_address
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signature verification failed: {str(e)}")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Dependency to get current authenticated user from JWT token.

    Usage in routes:
        @router.get("/profile")
        async def get_profile(wallet: str = Depends(get_current_user)):
            # wallet contains authenticated user's address
            pass
    """
    try:
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )

        wallet_address: str = payload.get("sub")

        if not wallet_address:
            raise HTTPException(status_code=401, detail="Invalid token")

        return wallet_address.lower()

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.get("/me")
async def get_current_user_profile(wallet_address: str = Depends(get_current_user)):
    """
    Get current user's profile from IPFS.

    Requires authentication (JWT token in header).

    Example request:
        GET /auth/me
        Authorization: Bearer eyJhbGc...

    Example response:
        {
            "wallet_address": "0x1234...",
            "username": "alice",
            "bio": "Eco enthusiast",
            "avatar_cid": "QmXyz...",
            "following": ["0x5678..."],
            "followers": ["0x9abc..."]
        }
    """
    profile = await user_service.get_profile(wallet_address)

    if not profile:
        # Create profile if doesn't exist
        profile, _ = await user_service.get_or_create_profile(wallet_address)

    return profile


@router.put("/profile")
async def update_profile(
    update_data: ProfileUpdateRequest,
    wallet_address: str = Depends(get_current_user)
):
    """
    Update user profile.

    Requires authentication.

    Example request:
        PUT /auth/profile
        Authorization: Bearer eyJhbGc...
        {
            "username": "alice_eco",
            "bio": "Saving the planet one document at a time 🌍"
        }

    Example response:
        {
            "success": true,
            "new_profile_cid": "QmNewCid123...",
            "message": "Profile updated successfully"
        }
    """
    new_cid = await user_service.update_profile(
        wallet_address,
        username=update_data.username,
        bio=update_data.bio,
        avatar_cid=update_data.avatar_cid
    )

    if not new_cid:
        raise HTTPException(status_code=500, detail="Failed to update profile")

    return {
        "success": True,
        "new_profile_cid": new_cid,
        "message": "Profile updated successfully"
    }


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}