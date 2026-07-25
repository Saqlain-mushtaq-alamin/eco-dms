"""
Social Auth Routes — OAuth2 sign-in via Google, GitHub, Twitter/X.
Creates a deterministic pseudo-wallet address from (provider, provider_user_id)
so the JWT sub field stays compatible with the rest of the system.
No real on-chain wallet is created — the user gets a "social:provider:id" identity.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from backend.app.config import settings
from backend.app.services.redis_service import redis_service
import jwt
import time
import hashlib
import os
import secrets
import httpx
import logging

logger = logging.getLogger(__name__)

social_router = APIRouter()

# ── helpers ──────────────────────────────────────────────────────────────────

FRONTEND_ORIGIN = settings.FRONTEND_ORIGIN  # e.g. http://localhost:5173

def _social_pseudo_address(provider: str, provider_id: str) -> str:
    """Create a deterministic 42-char hex address from provider + id."""
    raw = f"social:{provider}:{provider_id}"
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return "0x" + digest[:40]  # 40 hex = 20 bytes like an Ethereum address

def _make_jwt(pseudo_address: str, social_meta: dict) -> str:
    payload = {
        "sub": pseudo_address,
        "social": social_meta,          # { provider, username, avatar, email }
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.SESSION_TTL_SECONDS,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def _state_key(state: str) -> str:
    return f"oauth:state:{state}"

def _new_state(provider: str) -> str:
    state = secrets.token_urlsafe(16)
    redis_service.set_str(_state_key(state), provider, ex=300)
    return state

def _check_state(state: str) -> str:
    """Returns the provider if state is valid, raises 400 otherwise."""
    provider = redis_service.get_str(_state_key(state))
    if not provider:
        raise HTTPException(400, "Invalid or expired OAuth state")
    redis_service.delete(_state_key(state))
    return provider

# ── env vars (set these in backend/.env) ─────────────────────────────────────
# GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
# GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
# TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET

def _env(key: str) -> str:
    return os.environ.get(key, "")

# ── GOOGLE ────────────────────────────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_SCOPE = "openid email profile"

@social_router.get("/api/auth/social/google")
async def google_login(request: Request):
    client_id = _env("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(501, "Google OAuth not configured. Set GOOGLE_CLIENT_ID in backend/.env")
    state = _new_state("google")
    redirect_uri = f"{request.base_url}api/auth/social/google/callback"
    url = (
        f"{GOOGLE_AUTH_URL}?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={GOOGLE_SCOPE.replace(' ', '+')}"
        f"&state={state}"
        f"&access_type=offline"
    )
    return RedirectResponse(url)

@social_router.get("/api/auth/social/google/callback")
async def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error={error}")
    _check_state(state)
    client_id = _env("GOOGLE_CLIENT_ID")
    client_secret = _env("GOOGLE_CLIENT_SECRET")
    redirect_uri = f"{request.base_url}api/auth/social/google/callback"

    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code, "client_id": client_id, "client_secret": client_secret,
            "redirect_uri": redirect_uri, "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error=token_exchange_failed")
        token_data = token_res.json()
        access_token = token_data.get("access_token")

        info_res = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        if info_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error=userinfo_failed")
        info = info_res.json()

    provider_id = info.get("sub", "")
    pseudo_address = _social_pseudo_address("google", provider_id)
    meta = {
        "provider": "google",
        "username": info.get("name", ""),
        "avatar": info.get("picture", ""),
        "email": info.get("email", ""),
    }
    token = _make_jwt(pseudo_address, meta)
    return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_token={token}&social_provider=google&social_username={meta['username']}")


# ── GITHUB ────────────────────────────────────────────────────────────────────

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"

@social_router.get("/api/auth/social/github")
async def github_login(request: Request):
    client_id = _env("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(501, "GitHub OAuth not configured. Set GITHUB_CLIENT_ID in backend/.env")
    state = _new_state("github")
    redirect_uri = f"{request.base_url}api/auth/social/github/callback"
    url = (
        f"{GITHUB_AUTH_URL}?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=read:user+user:email"
        f"&state={state}"
    )
    return RedirectResponse(url)

@social_router.get("/api/auth/social/github/callback")
async def github_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error={error}")
    _check_state(state)
    client_id = _env("GITHUB_CLIENT_ID")
    client_secret = _env("GITHUB_CLIENT_SECRET")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(GITHUB_TOKEN_URL,
            data={"client_id": client_id, "client_secret": client_secret, "code": code},
            headers={"Accept": "application/json"},
        )
        if token_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error=token_exchange_failed")
        token_data = token_res.json()
        access_token = token_data.get("access_token", "")

        user_res = await client.get(GITHUB_USER_URL, headers={
            "Authorization": f"Bearer {access_token}", "Accept": "application/json"
        })
        if user_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error=userinfo_failed")
        info = user_res.json()

    provider_id = str(info.get("id", ""))
    pseudo_address = _social_pseudo_address("github", provider_id)
    meta = {
        "provider": "github",
        "username": info.get("login", "") or info.get("name", ""),
        "avatar": info.get("avatar_url", ""),
        "email": info.get("email", ""),
    }
    token = _make_jwt(pseudo_address, meta)
    return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_token={token}&social_provider=github&social_username={meta['username']}")


# ── TWITTER / X ───────────────────────────────────────────────────────────────

TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize"
TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
TWITTER_USER_URL = "https://api.twitter.com/2/users/me"
TWITTER_SCOPE = "tweet.read users.read offline.access"

@social_router.get("/api/auth/social/twitter")
async def twitter_login(request: Request):
    client_id = _env("TWITTER_CLIENT_ID")
    if not client_id:
        raise HTTPException(501, "Twitter OAuth not configured. Set TWITTER_CLIENT_ID in backend/.env")
    state = _new_state("twitter")
    redirect_uri = f"{request.base_url}api/auth/social/twitter/callback"
    # Twitter uses PKCE — store code_verifier in Redis keyed by state
    code_verifier = secrets.token_urlsafe(43)
    code_challenge = code_verifier  # plain method for simplicity; use S256 in production
    redis_service.set_str(f"oauth:pkce:{state}", code_verifier, ex=300)
    url = (
        f"{TWITTER_AUTH_URL}?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={TWITTER_SCOPE.replace(' ', '%20')}"
        f"&state={state}"
        f"&code_challenge={code_challenge}"
        f"&code_challenge_method=plain"
    )
    return RedirectResponse(url)

@social_router.get("/api/auth/social/twitter/callback")
async def twitter_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error={error}")
    _check_state(state)
    client_id = _env("TWITTER_CLIENT_ID")
    client_secret = _env("TWITTER_CLIENT_SECRET")
    code_verifier = redis_service.get_str(f"oauth:pkce:{state}") or ""
    redirect_uri = f"{request.base_url}api/auth/social/twitter/callback"

    import base64
    creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    async with httpx.AsyncClient() as client:
        token_res = await client.post(TWITTER_TOKEN_URL,
            data={
                "code": code, "grant_type": "authorization_code",
                "client_id": client_id, "redirect_uri": redirect_uri,
                "code_verifier": code_verifier,
            },
            headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error=token_exchange_failed")
        token_data = token_res.json()
        access_token = token_data.get("access_token", "")

        user_res = await client.get(
            f"{TWITTER_USER_URL}?user.fields=profile_image_url,username,name",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_res.status_code != 200:
            return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_error=userinfo_failed")
        info = user_res.json().get("data", {})

    provider_id = str(info.get("id", ""))
    pseudo_address = _social_pseudo_address("twitter", provider_id)
    meta = {
        "provider": "twitter",
        "username": info.get("username", "") or info.get("name", ""),
        "avatar": info.get("profile_image_url", ""),
        "email": "",
    }
    token = _make_jwt(pseudo_address, meta)
    return RedirectResponse(f"{FRONTEND_ORIGIN}/signin?social_token={token}&social_provider=twitter&social_username={meta['username']}")


# ── Status endpoint — lets frontend check if OAuth is configured ──────────────

@social_router.get("/api/auth/social/status")
async def social_auth_status():
    return {
        "google":  bool(_env("GOOGLE_CLIENT_ID")),
        "github":  bool(_env("GITHUB_CLIENT_ID")),
        "twitter": bool(_env("TWITTER_CLIENT_ID")),
    }
