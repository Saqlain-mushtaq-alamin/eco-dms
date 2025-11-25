"""
Configuration with remote IPFS gateway option.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Eco-DMS Decentralized"
    
    # IPFS Configuration - use remote gateway if local not available
    # Option 1: Local IPFS node
    # IPFS_API_URL: str = "http://127.0.0.1:5001"
    
    # Option 2: Remote IPFS (Infura - requires account)
    # IPFS_API_URL: str = "/dns/ipfs.infura.io/tcp/5001/https"
    
    # Option 3: Just use Pinata for everything (simplest)
    IPFS_API_URL: str = ""  # Leave empty to use Pinata only
    IPFS_GATEWAY_URL: str = "https://gateway.pinata.cloud/ipfs/"
    
    # Pinata Configuration (REQUIRED if no local IPFS)
    PINATA_API_KEY: str = ""
    PINATA_SECRET_KEY: str = ""
    PINATA_JWT: str = ""  # Get from https://app.pinata.cloud/keys
    
    # JWT Configuration
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()