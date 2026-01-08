"""
User Service - manages user profiles using OrbitDB (FULLY DECENTRALIZED & FREE).

No centralized database - users own their data via OrbitDB!
No gas fees - OrbitDB is free to use!

Architecture:
- User profiles stored on OrbitDB (decentralized P2P database)
- Built on IPFS (no central server)
- User controls their data via wallet signatures
- Backend is just a gateway - doesn't permanently store data
- Redis used ONLY for optional temporary caching (can be rebuilt)
"""
import os
import sys
from typing import Optional, List, Dict
from datetime import datetime
from backend.app.models import UserProfile
from backend.app.services.ipfs_service import ipfs_service
from backend.app.services.pinata_service import pinata_service
from backend.app.services.redis_service import redis_service
from backend.app.services.orbitdb_service import orbitdb_service
from backend.app.config import settings

# Fix: __file__ is automatically available, but make sure sys.path is set correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class UserService:
    def __init__(self):
        self.orbit = orbitdb_service
        
    def _cache_key(self, addr: str) -> str:
        """Redis cache key for TEMPORARY caching only (optional performance optimization)."""
        return f"cache:profile:{addr.lower()}"

    def _serialize_profile(self, profile: dict) -> dict:
        """Convert datetime objects to ISO strings for JSON serialization."""
        serialized = {}
        for key, value in profile.items():
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, (list, tuple)):
                serialized[key] = [
                    v.isoformat() if isinstance(v, datetime) else v 
                    for v in value
                ]
            else:
                serialized[key] = value
        return serialized

    async def get_or_create_profile(self, wallet_address: str) -> tuple[UserProfile, Optional[str]]:
        """
        Get user profile from OrbitDB or create default one.
        Returns (profile, orbit_db_address)
        
        DECENTRALIZED & FREE: Profile stored on OrbitDB, controlled by user's wallet.
        """
        addr = wallet_address.lower()
        
        # Try to get from OrbitDB first
        profile_data = await self.orbit.get_profile_data(addr)
        
        if profile_data:
            profile = UserProfile(**profile_data)
            orbit_addr = await self.orbit.get_db_address(addr, "profile")
            return (profile, orbit_addr)
        
        # Create default minimal profile
        profile = UserProfile(
            wallet_address=addr, 
            followers=[], 
            following=[], 
            username="", 
            bio="", 
            avatar_cid="",
            documents_cid=""
        )
        
        # Save to OrbitDB (user owns this data)
        orbit_addr = await self.save_profile(profile)
        return (profile, orbit_addr)

    async def save_profile(self, profile: UserProfile) -> Optional[str]:
        """
        Save profile to OrbitDB (fully decentralized, free).
        
        Priority:
        1. OrbitDB (fully decentralized, free, user-owned)
        2. IPFS/Pinata (decentralized content storage)
        
        Redis used ONLY for temporary caching (30-day TTL).
        """
        data = profile.model_dump() if hasattr(profile, "model_dump") else dict(profile)
        now = datetime.utcnow().isoformat()
        data["updated_at"] = now
        if not data.get("created_at"):
            data["created_at"] = now
        
        # Serialize datetime objects
        data = self._serialize_profile(data)
        wallet_addr = data["wallet_address"].lower()
        
        # Save to OrbitDB (free, decentralized, user-owned!)
        success = await self.orbit.update_profile_data(wallet_addr, data)
        
        if success:
            orbit_addr = await self.orbit.get_db_address(wallet_addr, "profile")
            print(f"✅ Profile saved to OrbitDB (FREE, decentralized): {orbit_addr}")
            
            # Optional cache for performance (30 days, can be rebuilt)
            redis_service.set_json(self._cache_key(wallet_addr), data, ex=30*24*3600)
            return orbit_addr
        
        # Fallback: OrbitDB might not be initialized yet, create it
        orbit_addr = await self.orbit.create_user_profile_db(wallet_addr)
        if orbit_addr:
            # Now update with actual data
            success = await self.orbit.update_profile_data(wallet_addr, data)
            if success:
                print(f"✅ Created OrbitDB and saved profile (FREE!)")
                redis_service.set_json(self._cache_key(wallet_addr), data, ex=30*24*3600)
                return orbit_addr
        
        # Final fallback to IPFS (still decentralized)
        print(f"⚠️ OrbitDB not available, using IPFS fallback...")
        try:
            cid = ipfs_service.add_json(data)
            if cid:
                print(f"✅ Profile stored in IPFS: {cid}")
                redis_service.set_json(self._cache_key(wallet_addr), data, ex=30*24*3600)
                return cid
        except Exception as e:
            print(f"⚠️ IPFS add_json failed: {e}")

        # Pinata fallback
        try:
            cid = pinata_service.pin_json(data)
            if cid:
                print(f"✅ Profile stored in Pinata: {cid}")
                redis_service.set_json(self._cache_key(wallet_addr), data, ex=30*24*3600)
                return cid
        except Exception as e:
            print(f"❌ Pinata pin_json failed: {e}")
        
        return None

    async def get_profile(self, wallet_address: str) -> Optional[UserProfile]:
        """
        Get user profile from decentralized storage (OrbitDB or IPFS).
        """
        addr = wallet_address.lower()
        
        # Try OrbitDB first
        profile_data = await self.orbit.get_profile_data(addr)
        if profile_data:
            return UserProfile(**profile_data)
        
        # Check temporary cache
        cached = redis_service.get_json(self._cache_key(addr))
        if cached:
            return UserProfile(**cached)
        
        return None

    async def update_profile(self, wallet_address: str, username: Optional[str]=None, bio: Optional[str]=None, avatar_cid: Optional[str]=None) -> Optional[str]:
        prof, _ = await self.get_or_create_profile(wallet_address)
        if username is not None: 
            prof.username = username
        if bio is not None: 
            prof.bio = bio
        if avatar_cid is not None: 
            prof.avatar_cid = avatar_cid
        return await self.save_profile(prof)

    async def follow_user(self, follower_address: str, following_address: str) -> bool:
        follower, _ = await self.get_or_create_profile(follower_address)
        target, _ = await self.get_or_create_profile(following_address)
        fa, ta = follower_address.lower(), following_address.lower()
        if ta not in [a.lower() for a in follower.following]:
            follower.following.append(ta)
        if fa not in [a.lower() for a in target.followers]:
            target.followers.append(fa)
        await self.save_profile(follower)
        await self.save_profile(target)
        return True

    async def unfollow_user(self, follower_address: str, following_address: str) -> bool:
        follower, _ = await self.get_or_create_profile(follower_address)
        target, _ = await self.get_or_create_profile(following_address)
        follower.following = [a for a in follower.following if a.lower()!=following_address.lower()]
        target.followers = [a for a in target.followers if a.lower()!=follower_address.lower()]
        await self.save_profile(follower)
        await self.save_profile(target)
        return True

    async def get_followers(self, wallet_address: str) -> List[str]:
        prof, _ = await self.get_or_create_profile(wallet_address)
        return prof.followers

    async def get_following(self, wallet_address: str) -> List[str]:
        prof, _ = await self.get_or_create_profile(wallet_address)
        return prof.following

    async def get_all_users(self) -> List[dict]:
        """
        Get all users from decentralized network.
        
        FULLY DECENTRALIZED: Query Ceramic Network for all user profiles.
        No centralized user registry!
        
        For now using IPFS as fallback, but should query Ceramic ComposeDB.
        """
        users = []
        
        # TODO: Query Ceramic ComposeDB for all UserProfile streams
        # query = '''
        #   query {
        #     userProfileIndex(first: 1000) {
        #       edges {
        #         node {
        #           author { id }
        #           username
        #           bio
        #           avatarCID
        #         }
        #       }
        #     }
        #   }
        # '''
        
        print(f"⚠️ get_all_users not fully decentralized yet - needs Ceramic ComposeDB query")
        
        # Fallback: use cache if available
        # This is temporary and should be replaced with Ceramic query
        
        return users


user_service = UserService()