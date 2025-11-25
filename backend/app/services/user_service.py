"""
User Service - manages user profiles in IPFS.
Replaces database queries with IPFS operations.
"""
from typing import Optional
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import UserProfile
from services.ipfs_service import ipfs_service
from services.pinata_service import pinata_service


class UserService:
    """
    Handles user profile storage in IPFS.
    
    Data flow:
    1. User logs in with wallet
    2. Check if profile exists (in cache or IPFS)
    3. If not, create new profile
    4. Store profile as JSON in IPFS
    5. Pin to Pinata for persistence
    """
    
    def __init__(self):
        """
        Initialize with in-memory cache.
        Maps wallet_address -> profile_cid
        
        Note: This cache is temporary (lost on restart).
        For production, use Redis or store mapping on-chain.
        """
        self.user_cache = {}  # {wallet_address: profile_cid}
    
    async def get_or_create_profile(self, wallet_address: str) -> tuple[UserProfile, Optional[str]]:
        """
        Get existing profile or create new one.
        
        Args:
            wallet_address: User's Ethereum address
            
        Returns:
            (UserProfile, cid) tuple
            
        Example:
            profile, cid = await user_service.get_or_create_profile("0x123...")
            print(profile.username)  # "user_0x123456"
        """
        # Check cache first
        if wallet_address in self.user_cache:
            cid = self.user_cache[wallet_address]
            data = ipfs_service.get_json(cid)
            
            if data:
                # Parse datetime strings back to datetime objects
                data['created_at'] = datetime.fromisoformat(data['created_at'])
                data['updated_at'] = datetime.fromisoformat(data['updated_at'])
                
                profile = UserProfile(**data)
                return profile, cid
        
        # Create new profile
        profile = UserProfile(
            wallet_address=wallet_address,
            username=f"user_{wallet_address[:8]}",  # Default: "user_0x123456"
            bio="New Eco-DMS user 🌱",
            avatar_cid=None,
            documents_cid=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Save to IPFS
        cid = await self.save_profile(profile)
        
        return profile, cid
    
    async def save_profile(self, profile: UserProfile) -> Optional[str]:
        """
        Save profile to IPFS and pin it.
        
        Args:
            profile: UserProfile to save
            
        Returns:
            IPFS CID of saved profile
            
        Steps:
        1. Update timestamp
        2. Convert to dict
        3. Convert datetime to ISO string
        4. Add to IPFS
        5. Pin to Pinata
        6. Update cache
        """
        try:
            profile.updated_at = datetime.utcnow()
            
            # Convert to dict for IPFS storage
            data = profile.model_dump()
            
            # Convert datetime to string (JSON serializable)
            data['created_at'] = data['created_at'].isoformat()
            data['updated_at'] = data['updated_at'].isoformat()
            
            # Add to IPFS
            cid = ipfs_service.add_json(data)
            
            if not cid:
                return None
            
            # Pin to Pinata (ensures it stays available)
            pinata_service.pin_by_cid(
                cid,
                name=f"profile_{profile.wallet_address[:10]}"
            )
            
            # Update cache
            self.user_cache[profile.wallet_address] = cid
            
            print(f"✅ Profile saved: {profile.wallet_address} -> {cid}")
            return cid
            
        except Exception as e:
            print(f"❌ Save profile failed: {e}")
            return None
    
    async def get_profile(self, wallet_address: str) -> Optional[UserProfile]:
        """
        Get user profile from IPFS.
        
        Args:
            wallet_address: User's wallet
            
        Returns:
            UserProfile or None
        """
        if wallet_address not in self.user_cache:
            return None
        
        cid = self.user_cache[wallet_address]
        data = ipfs_service.get_json(cid)
        
        if not data:
            return None
        
        # Parse datetime strings
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        
        return UserProfile(**data)
    
    async def update_profile(
        self,
        wallet_address: str,
        username: Optional[str] = None,
        bio: Optional[str] = None,
        avatar_cid: Optional[str] = None
    ) -> Optional[str]:
        """
        Update user profile fields.
        
        Args:
            wallet_address: User's wallet
            username: New username (optional)
            bio: New bio (optional)
            avatar_cid: New avatar IPFS CID (optional)
            
        Returns:
            New profile CID
            
        Note: Creates new IPFS entry (immutable storage).
        Old profile CID still exists but won't be used.
        """
        profile = await self.get_profile(wallet_address)
        
        if not profile:
            profile, _ = await self.get_or_create_profile(wallet_address)
        
        # Update fields if provided
        if username:
            profile.username = username
        if bio:
            profile.bio = bio
        if avatar_cid:
            profile.avatar_cid = avatar_cid
        
        # Save (creates new CID)
        return await self.save_profile(profile)


# Global instance
user_service = UserService()