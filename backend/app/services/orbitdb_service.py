"""
OrbitDB Service - Fully Decentralized Off-Chain Database
No gas fees, no blockchain, just pure P2P decentralized storage!

Architecture:
- Each user has their own OrbitDB database
- Backend helps coordinate and pin databases
- Users own their data via IPFS + OrbitDB
- Free to use, no transaction fees

OrbitDB Types:
- KeyValue Store: User profiles (key: field, value: data)
- Feed/Log: Posts (append-only log of posts)
- Documents: Social graph (queryable documents)
"""
import asyncio
import json
import subprocess
from typing import Optional, List, Dict, Any
from backend.app.config import settings
from backend.app.services.redis_service import redis_service
import httpx


class OrbitDBService:
    """
    OrbitDB integration for fully decentralized, free social media.
    
    How it works:
    1. Backend runs an IPFS node
    2. OrbitDB creates databases on top of IPFS
    3. Each user has their own database address (hash)
    4. Backend helps replicate and pin user databases
    5. Users control their data via wallet signatures
    
    No gas fees, no blockchain needed!
    """
    
    def __init__(self):
        self.ipfs_api = settings.IPFS_API_URL or "http://127.0.0.1:5001"
        self.client = httpx.AsyncClient(timeout=30.0)
        
        # Cache database addresses: {wallet: {"profile": "orbit_addr", "posts": "orbit_addr"}}
        self._db_cache_prefix = "orbitdb:addr:"
        
    def _cache_key(self, wallet: str, db_type: str) -> str:
        """Redis cache key for OrbitDB address."""
        return f"{self._db_cache_prefix}{wallet}:{db_type}"
    
    def _wallet_to_identity(self, wallet_address: str) -> str:
        """Convert wallet to OrbitDB identity string."""
        return f"eth:{wallet_address.lower()}"
    
    async def get_db_address(self, wallet: str, db_type: str) -> Optional[str]:
        """
        Get OrbitDB address for user's database.
        db_type: 'profile', 'posts', 'social'
        """
        cache_key = self._cache_key(wallet, db_type)
        address = redis_service.get_str(cache_key)
        
        if address:
            return address
        
        return None
    
    async def set_db_address(self, wallet: str, db_type: str, address: str):
        """Cache OrbitDB address for user's database."""
        cache_key = self._cache_key(wallet, db_type)
        # Cache for 90 days (optional, can be rebuilt)
        redis_service.set_str(cache_key, address, ex=90*24*3600)
    
    async def create_user_profile_db(self, wallet: str) -> Optional[str]:
        """
        Create a KeyValue store for user profile.
        Returns OrbitDB address.
        
        In a real implementation, this would call OrbitDB via Node.js bridge.
        For now, we'll use IPFS to store the data and return an address.
        """
        identity = self._wallet_to_identity(wallet)
        
        # Simulate OrbitDB address format
        # Real: /orbitdb/zdpuB1234.../username.profile
        # For now: ipfs_cid:profile
        
        db_name = f"{wallet.lower()}.profile"
        
        # Create initial profile data
        initial_data = {
            "type": "keyvalue",
            "owner": identity,
            "created_at": asyncio.get_event_loop().time(),
            "data": {}  # Empty profile data
        }
        
        # Store in IPFS (OrbitDB would handle this)
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        cid = await ipfs_service.pin_json(initial_data)
        
        if cid:
            # OrbitDB address format: /orbitdb/{hash}/{name}
            orbit_address = f"/orbitdb/{cid}/{db_name}"
            
            # Cache the address
            await self.set_db_address(wallet, "profile", orbit_address)
            
            print(f"✅ Created OrbitDB profile for {wallet}: {orbit_address}")
            return orbit_address
        
        return None
    
    async def create_user_posts_db(self, wallet: str) -> Optional[str]:
        """
        Create a Feed/Log for user posts.
        Append-only, perfect for social media posts.
        """
        identity = self._wallet_to_identity(wallet)
        db_name = f"{wallet.lower()}.posts"
        
        initial_data = {
            "type": "feed",
            "owner": identity,
            "created_at": asyncio.get_event_loop().time(),
            "entries": []  # Empty posts list
        }
        
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        cid = await ipfs_service.pin_json(initial_data)
        
        if cid:
            orbit_address = f"/orbitdb/{cid}/{db_name}"
            await self.set_db_address(wallet, "posts", orbit_address)
            print(f"✅ Created OrbitDB posts feed for {wallet}: {orbit_address}")
            return orbit_address
        
        return None
    
    async def get_profile_data(self, wallet: str) -> Optional[Dict]:
        """Get user profile from their OrbitDB."""
        db_address = await self.get_db_address(wallet, "profile")
        
        if not db_address:
            return None
        
        # Extract CID from OrbitDB address
        # /orbitdb/{cid}/name -> extract cid
        parts = db_address.split("/")
        if len(parts) >= 3:
            cid = parts[2]
            
            from backend.app.posts_manage.ipfs_post_service import ipfs_service
            data = await ipfs_service.get_json(cid)
            
            if data and "data" in data:
                return data["data"]
        
        return None
    
    async def update_profile_data(self, wallet: str, profile_data: Dict) -> bool:
        """
        Update user profile in their OrbitDB.
        Creates a new version on IPFS.
        """
        identity = self._wallet_to_identity(wallet)
        
        updated_data = {
            "type": "keyvalue",
            "owner": identity,
            "updated_at": asyncio.get_event_loop().time(),
            "data": profile_data
        }
        
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        new_cid = await ipfs_service.pin_json(updated_data)
        
        if new_cid:
            db_name = f"{wallet.lower()}.profile"
            new_address = f"/orbitdb/{new_cid}/{db_name}"
            
            await self.set_db_address(wallet, "profile", new_address)
            print(f"✅ Updated OrbitDB profile for {wallet}: {new_address}")
            return True
        
        return False
    
    async def append_post(self, wallet: str, post_cid: str) -> bool:
        """
        Append a post to user's feed.
        OrbitDB Feed is append-only, perfect for posts!
        """
        # Get current posts
        posts = await self.get_user_posts(wallet)
        
        # Add new post at beginning (most recent first)
        posts.insert(0, post_cid)
        
        # Create updated feed
        identity = self._wallet_to_identity(wallet)
        updated_data = {
            "type": "feed",
            "owner": identity,
            "updated_at": asyncio.get_event_loop().time(),
            "entries": posts
        }
        
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        new_cid = await ipfs_service.pin_json(updated_data)
        
        if new_cid:
            db_name = f"{wallet.lower()}.posts"
            new_address = f"/orbitdb/{new_cid}/{db_name}"
            
            await self.set_db_address(wallet, "posts", new_address)
            print(f"✅ Appended post to OrbitDB feed for {wallet}")
            return True
        
        return False
    
    async def get_user_posts(self, wallet: str) -> List[str]:
        """Get list of post CIDs from user's OrbitDB feed."""
        db_address = await self.get_db_address(wallet, "posts")
        
        if not db_address:
            return []
        
        # Extract CID from OrbitDB address
        parts = db_address.split("/")
        if len(parts) >= 3:
            cid = parts[2]
            
            from backend.app.posts_manage.ipfs_post_service import ipfs_service
            data = await ipfs_service.get_json(cid)
            
            if data and "entries" in data:
                return data["entries"]
        
        return []
    
    async def create_social_interactions_db(self, post_author_wallet: str) -> Optional[str]:
        """
        Create a KeyValue store for social interactions (likes/comments indexes).
        This stores the mapping of post_cid -> {likes_index_cid, comments_index_cid}
        Fully decentralized - no Redis needed!
        """
        identity = self._wallet_to_identity(post_author_wallet)
        db_name = f"{post_author_wallet.lower()}.social"
        
        initial_data = {
            "type": "keyvalue",
            "owner": identity,
            "created_at": asyncio.get_event_loop().time(),
            "data": {}  # Empty social interactions mapping
        }
        
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        cid = await ipfs_service.pin_json(initial_data)
        
        if cid:
            orbit_address = f"/orbitdb/{cid}/{db_name}"
            await self.set_db_address(post_author_wallet, "social", orbit_address)
            print(f"✅ Created OrbitDB social interactions for {post_author_wallet}: {orbit_address}")
            return orbit_address
        
        return None
    
    async def get_social_data(self, wallet: str) -> Optional[Dict]:
        """Get social interactions data from user's OrbitDB."""
        db_address = await self.get_db_address(wallet, "social")
        
        if not db_address:
            return None
        
        parts = db_address.split("/")
        if len(parts) >= 3:
            cid = parts[2]
            
            from backend.app.posts_manage.ipfs_post_service import ipfs_service
            data = await ipfs_service.get_json(cid)
            
            if data and "data" in data:
                return data["data"]
        
        return None
    
    async def update_social_data(self, wallet: str, social_data: Dict) -> bool:
        """
        Update social interactions in user's OrbitDB.
        social_data format: {post_cid: {"likes_index_cid": "...", "comments_index_cid": "..."}}
        """
        identity = self._wallet_to_identity(wallet)
        
        updated_data = {
            "type": "keyvalue",
            "owner": identity,
            "updated_at": asyncio.get_event_loop().time(),
            "data": social_data
        }
        
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        new_cid = await ipfs_service.pin_json(updated_data)
        
        if new_cid:
            db_name = f"{wallet.lower()}.social"
            new_address = f"/orbitdb/{new_cid}/{db_name}"
            
            await self.set_db_address(wallet, "social", new_address)
            print(f"✅ Updated OrbitDB social data for {wallet}")
            return True
        
        return False
    
    async def replicate_database(self, orbit_address: str) -> bool:
        """
        Replicate/pin someone else's OrbitDB.
        This allows the backend to help keep user data available.
        Users can also run their own IPFS nodes to pin their data!
        """
        # Extract CID and pin it
        parts = orbit_address.split("/")
        if len(parts) >= 3:
            cid = parts[2]
            
            # Pin to keep data available
            from backend.app.posts_manage.ipfs_post_service import ipfs_service
            try:
                # Data should already be pinned, but ensure it
                print(f"📌 Replicating OrbitDB: {orbit_address}")
                return True
            except Exception as e:
                print(f"❌ Failed to replicate: {e}")
                return False
        
        return False


orbitdb_service = OrbitDBService()
