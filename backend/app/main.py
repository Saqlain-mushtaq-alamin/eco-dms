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

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Decentralized Document Management System using IPFS",
    version="2.0.0"
)

# CORS configuration - allows frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(user_router, prefix=settings.API_V1_STR)  # Add this line

# Legacy and other routers
app.include_router(auth_router)

# SIWE under /api/siwe/... if API_V1_STR is /api or /api/v1
try:
    from .config import settings
    api_prefix = settings.API_V1_STR or "/api"
except Exception:
    api_prefix = "/api"

app.include_router(siwe_router, prefix=api_prefix)
# Absolute aliases that directly match /api/siwe/... even if no prefix is set
app.include_router(siwe_alias_router)


@app.on_event("startup")
async def startup_event():
    """
    Run on application startup.
    Check IPFS connection.
    """
    print("🚀 Starting Eco-DMS Decentralized Backend...")
    
    if ipfs_service.client:
        print("✅ IPFS connected via API:", settings.IPFS_API_URL)
    else:
        print("⚠️ IPFS not connected - using Pinata-only mode")

    print("✅ Redis connected" if redis_service.ping() else f"⚠️ Redis not reachable: {settings.REDIS_URL}")


@app.get("/")
async def root():
    """
    Root endpoint - API info.
    """
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
    """
    Health check endpoint.
    Check if IPFS is connected.
    """
    return {
        "status": "healthy" if ipfs_service.client or settings.PINATA_JWT else "degraded",
        "ipfs_connected": ipfs_service.client is not None,
        "pinata_configured": bool(settings.PINATA_JWT),
        "message": "System operational" if (ipfs_service.client or settings.PINATA_JWT) else "Configure Pinata or IPFS"
    }