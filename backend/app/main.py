"""
Main FastAPI application with IPFS integration.
No database - everything stored in IPFS!
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth_routes import router as auth_router
from .user_routes import router as user_router  # Add this import
from .config import settings
from .services.ipfs_service import ipfs_service

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


@app.on_event("startup")
async def startup_event():
    """
    Run on application startup.
    Check IPFS connection.
    """
    print("🚀 Starting Eco-DMS Decentralized Backend...")
    
    if ipfs_service.client:
        print("✅ IPFS connected successfully")
    else:
        print("⚠️ IPFS not connected - using Pinata-only mode")


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