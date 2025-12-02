"""
Main FastAPI application with IPFS integration.
No database - everything stored in IPFS!
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.auth_routes import router as auth_router
from backend.app.auth_routes import siwe_router, siwe_alias_router
from backend.app.user_routes import router as user_router
from backend.app.config import settings
from backend.app.services.ipfs_service import ipfs_service
from backend.app.services.redis_service import redis_service
from .posts_manage.post_routes import router as posts_router

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Decentralized Document Management System using IPFS",
    version="2.0.0"
)

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