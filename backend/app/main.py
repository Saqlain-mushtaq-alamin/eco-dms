"""
Main FastAPI application with IPFS integration.
No database - everything stored in IPFS!
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth_routes import router as auth_router
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
        print("⚠️ IPFS not connected - please start IPFS daemon:")
        print("   Run: ipfs daemon")


@app.get("/")
async def root():
    """
    Root endpoint - API info.
    """
    return {
        "name": settings.PROJECT_NAME,
        "version": "2.0.0",
        "description": "Fully decentralized document management",
        "storage": "IPFS",
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
        "status": "healthy" if ipfs_service.client else "degraded",
        "ipfs_connected": ipfs_service.client is not None,
        "message": "IPFS connected" if ipfs_service.client else "IPFS not connected - start daemon"
    }