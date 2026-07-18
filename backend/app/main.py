"""
Main FastAPI application with IPFS integration.
No database - everything stored in IPFS!
"""
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env using an absolute path so env vars are available
# regardless of the process working directory (e.g. when started from repo root).
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from .auth_routes import router as auth_router
from .auth_routes import siwe_router, siwe_alias_router
from .user_routes import router as user_router
from .config import settings
from .services.ipfs_service import ipfs_service
from .services.redis_service import redis_service
from .posts_manage.post_routes import router as posts_router
from .verify_routes import router as verify_router
from .notification_routes import router as notification_router
from .voting_routes import router as voting_router
from .portfolio_routes import router as portfolio_router, leaderboard_router

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Decentralized Document Management System using IPFS",
    version="2.0.0"
)

# Add GZip middleware for compression
app.add_middleware(GZipMiddleware, minimum_size=512)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes with correct prefixes
app.include_router(auth_router, prefix="/auth")  # /auth/nonce, /auth/verify, etc.
app.include_router(user_router)  # /api/users/me (prefix already in router)
app.include_router(siwe_router, prefix="/api/siwe")  # /api/siwe/nonce, /api/siwe/verify
app.include_router(siwe_alias_router)  # Direct /api/siwe/... routes
app.include_router(posts_router)  # Include posts router
app.include_router(verify_router)  # ML verification routes
app.include_router(notification_router)  # Decentralized notifications routes
app.include_router(voting_router)  # Community voting routes
app.include_router(portfolio_router)   # Eco Portfolio routes
app.include_router(leaderboard_router)  # Leaderboard routes


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    print("🚀 Starting Eco-DMS Decentralized Backend...")
    
    if ipfs_service.client:
        print("✅ IPFS connected via API:", settings.IPFS_API_URL)
    else:
        print("⚠️ IPFS not connected - using Pinata-only mode")

    print("✅ Redis connected" if redis_service.ping() else f"⚠️ Redis not reachable: {settings.REDIS_URL}")


@app.get("/")
async def root():
    """Root endpoint - API info."""
    return {
        "name": settings.PROJECT_NAME,
        "version": "2.0.0",
        "description": "Fully decentralized document management",
        "storage": "IPFS + Pinata",
        "database": "None (decentralized)",
        "ipfs_connected": ipfs_service.client is not None
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy" if ipfs_service.client or settings.PINATA_JWT else "degraded",
        "ipfs_connected": ipfs_service.client is not None,
        "pinata_configured": bool(settings.PINATA_JWT),
        "message": "System operational" if (ipfs_service.client or settings.PINATA_JWT) else "Configure Pinata or IPFS"
    }