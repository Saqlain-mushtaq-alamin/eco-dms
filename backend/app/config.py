"""
Configuration management for decentralized backend.
Loads environment variables for IPFS and Pinata integration.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """
    Application settings loaded from .env file.
    No more database URLs - we're using IPFS for storage!
    """
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Eco-DMS Decentralized"
    
    # IPFS Configuration - connects to local IPFS node
    IPFS_API_URL: str = "http://127.0.0.1:5001"
    IPFS_GATEWAY_URL: str = "https://ipfs.io/ipfs/"
    
    # Pinata - pins content to prevent garbage collection
    PINATA_API_KEY: str = ""
    PINATA_SECRET_KEY: str = ""
    PINATA_JWT: str = ""
    
    # JWT Configuration - for session management
    JWT_SECRET_KEY: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours
    
    # CORS - frontend access control
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()