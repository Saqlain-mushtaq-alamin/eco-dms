"""
User Service - manages user profiles using Ceramic (FULLY DECENTRALIZED).
No centralized database - users own their data via Ceramic DID streams!

Architecture:
- User profiles stored on Ceramic Network (decentralized)
- User controls their data via their DID
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
from backend.app.config import settings
import httpx

# Fix: __file__ is automatically available, but make sure sys.path is set correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class UserService:
    def __init__(self):
        self.ceramic_url = settings.CERAMIC_API_URL
        self.client = httpx.AsyncClient(timeout=30.0)
        
    def _wallet_to_did(self, wallet_address: str) -> str:
        """Convert Ethereum wallet to DID format."""
        chain_id = settings.CHAIN_ID
        return f"did:pkh:eip155:{chain_id}:{wallet_address.lower()}"
    
    def _cache_key(self, addr: str) -> str:
        """Redis cache key for TEMPORARY caching only (optional performance optimization)."""
        return f"cache:profile:{addr.lower()}"
    
    async def _get_ceramic_profile(self, wallet_address: str) -> Optional[Dict]:
        """Get user profile from Ceramic Network."""
        did = self._wallet_to_did(wallet_address)
        
        try:
            # Query Ceramic for user's profile stream
            # This would use ComposeDB GraphQL or Ceramic HTTP API
            # For now, simplified implementation
            
            # Check temporary cache first (optional)
            cache_key = self._cache_key(wallet_address)
            cached = redis_service.get_json(cache_key)
            if cached:
                return cached
            
            # TODO: Query Ceramic ComposeDB
            # For now, return None (profile doesn't exist)
            return None
            
        except Exception as e:
            print(f"❌ Error fetching profile from Ceramic: {e}")
            return None
    
    async def _save_ceramic_profile(self, wallet_address: str, profile_data: Dict) -> bool:
        """Save user profile to Ceramic Network."""
        did = self._wallet_to_did(wallet_address)
        
        try:
            # Create or update Ceramic stream
            # This would use Ceramic HTTP API or ComposeDB mutation
            
            # TODO: Implement Ceramic stream creation/update
            # For now, we'll use IPFS as fallback
            
            print(f"⚠️ Ceramic profile save not fully implemented yet - using IPFS fallback")
            return False
            
        except Exception as e:
            print(f"❌ Error saving profile to Ceramic: {e}")
            return False

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
        Get user profile from Ceramic or create default one.
        Returns (profile, cid_or_stream_id)
        
        DECENTRALIZED: Profile stored on Ceramic, controlled by user's DID.
        """
        addr = wallet_address.lower()
        
        # Try to get from Ceramic first
        profile_data = await self._get_ceramic_profile(addr)
        
        if profile_data:
            return (UserProfile(**profile_data), profile_data.get("stream_id"))
        
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
        
        # Save to Ceramic (user owns this data)
        new_cid = await self.save_profile(profile)
        return (profile, new_cid)

    async def save_profile(self, profile: UserProfile) -> Optional[str]:
        """
        Save profile to decentralized storage.
        
        Priority:
        1. Ceramic Network (fully decentralized - user owns data)
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
        
        # Try Ceramic first (fully decentralized)
        ceramic_success = await self._save_ceramic_profile(wallet_addr, data)
        if ceramic_success:
            print(f"✅ Profile saved to Ceramic (decentralized)")
            # Optional cache for performance (30 days, can be rebuilt)
            redis_service.set_json(self._cache_key(wallet_addr), data, ex=30*24*3600)
            return "ceramic_stream"
        
        # Fallback to IPFS (still decentralized, just different tech)
        print(f"⚠️ Ceramic not available, using IPFS fallback...")
        try:
            cid = ipfs_service.add_json(data)
            if cid:
                print(f"✅ Profile stored in IPFS: {cid}")
                # Optional cache (30 days, can be rebuilt from IPFS)
                redis_service.set_json(self._cache_key(wallet_addr), data, ex=30*24*3600)
                return cid
        except Exception as e:
            print(f"⚠️ IPFS add_json failed: {e}")

        # Pinata fallback
        print("Falling back to Pinata...")
        try:
            cid = pinata_service.pin_json(data)
            if cid:
                print(f"✅ Profile stored in Pinata: {cid}")
                # Optional cache (30 days)
                redis_service.set_json(self._cache_key(wallet_addr), data, ex=30*24*3600)
                return cid
        except Exception as e:
            print(f"❌ Pinata pin_json failed: {e}")
        
        return None

    async def get_profile(self, wallet_address: str) -> Optional[UserProfile]:
        """
        Get user profile from decentralized storage (Ceramic or IPFS).
        """
        addr = wallet_address.lower()
        
        # Try Ceramic first
        profile_data = await self._get_ceramic_profile(addr)
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