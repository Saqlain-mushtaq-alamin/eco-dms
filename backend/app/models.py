"""
Pydantic models for decentralized storage.
These are NOT database models - data stored in IPFS as JSON.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserProfile(BaseModel):
    """
    User profile stored in IPFS.
    Each user = one JSON file in IPFS.
    """
    wallet_address: str = Field(..., description="Ethereum wallet (user ID)")
    username: Optional[str] = Field(None, description="Display name")
    bio: Optional[str] = Field(None, description="User bio")
    avatar_cid: Optional[str] = Field(None, description="IPFS CID of avatar image")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Social graph
    following: List[str] = Field(default_factory=list, description="Wallet addresses following")
    followers: List[str] = Field(default_factory=list, description="Followers' wallets")
    
    # User's documents index
    documents_cid: Optional[str] = Field(None, description="CID of document list")


class DocumentMetadata(BaseModel):
    """
    Document metadata in IPFS.
    Actual file stored separately in IPFS.
    """
    id: str = Field(..., description="Unique document ID")
    title: str
    description: Optional[str] = None
    
    # File info
    file_cid: str = Field(..., description="IPFS CID of actual file")
    file_name: str
    file_type: str = Field(..., description="MIME type")
    file_size: int = Field(..., description="Size in bytes")
    
    # Ownership
    owner_address: str = Field(..., description="Owner's wallet")
    shared_with: List[str] = Field(default_factory=list, description="Shared with these wallets")
    is_public: bool = Field(default=False)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    tags: List[str] = Field(default_factory=list)


# API Request/Response Models

class NonceRequest(BaseModel):
    """Request nonce for SIWE authentication."""
    wallet_address: str


class NonceResponse(BaseModel):
    """Return nonce and message to sign."""
    nonce: str
    message: str


class VerifyRequest(BaseModel):
    """Verify signed message."""
    wallet_address: str
    signature: str
    message: str


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    wallet_address: str


class ProfileUpdateRequest(BaseModel):
    """Update user profile."""
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_cid: Optional[str] = None