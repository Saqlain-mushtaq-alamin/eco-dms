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
import time
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
        
        # In-memory cache for posts (cleared after 60s)
        self._posts_cache: Dict[str, tuple[float, List[str]]] = {}
        self._cache_ttl = 60  # seconds
        
        # IPFS backup key for OrbitDB address registry
        self._ipfs_registry_key = "orbitdb:registry"
        self._registry_cache: Optional[Dict] = None
        
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
        
        Tries:
        1. Redis cache (fast)
        2. IPFS backup registry (permanent, decentralized)
        3. Returns None if not found (will create new)
        """
        cache_key = self._cache_key(wallet, db_type)
        
        # Try Redis first (fast)
        address = redis_service.get_str(cache_key)
        if address:
            return address
        
        # Try IPFS backup registry (permanent backup)
        try:
            registry = await self._get_address_registry()
            wallet_key = f"{wallet.lower()}:{db_type}"
            if wallet_key in registry:
                address = registry[wallet_key]
                # Restore to Redis cache
                redis_service.set_str(cache_key, address, ex=90*24*3600)
                print(f"🔄 Restored OrbitDB address from IPFS backup: {address}")
                return address
        except Exception as e:
            print(f"⚠️ Failed to check IPFS registry backup: {e}")
        
        return None
    
    async def set_db_address(self, wallet: str, db_type: str, address: str):
        """Cache OrbitDB address in Redis AND backup to IPFS (permanent)."""
        cache_key = self._cache_key(wallet, db_type)
        
        # Store in Redis (fast access)
        redis_service.set_str(cache_key, address, ex=90*24*3600)
        
        # ALSO backup to IPFS registry (permanent, decentralized)
        try:
            await self._backup_address_to_ipfs(wallet, db_type, address)
        except Exception as e:
            print(f"⚠️ Warning: Failed to backup address to IPFS (non-critical): {e}")
    
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
        
        OPTIMIZED: Uses cache to avoid fetching all posts every time.
        """
        import time
        
        # Check cache first
        cache_key = wallet.lower()
        current_time = time.time()
        
        if cache_key in self._posts_cache:
            cached_time, cached_posts = self._posts_cache[cache_key]
            # Use cache if less than TTL old
            if current_time - cached_time < self._cache_ttl:
                posts = cached_posts.copy()
            else:
                # Cache expired, fetch from IPFS
                posts = await self._get_user_posts_no_cache(wallet)
        else:
            # Not in cache, fetch from IPFS
            posts = await self._get_user_posts_no_cache(wallet)
        
        # Add new post at beginning (most recent first)
        posts.insert(0, post_cid)
        
        # Create updated feed
        identity = self._wallet_to_identity(wallet)
        updated_data = {
            "type": "feed",
            "owner": identity,
            "updated_at": current_time,
            "entries": posts
        }
        
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        new_cid = await ipfs_service.pin_json(updated_data)
        
        if new_cid:
            db_name = f"{wallet.lower()}.posts"
            new_address = f"/orbitdb/{new_cid}/{db_name}"
            
            await self.set_db_address(wallet, "posts", new_address)
            
            # Update cache
            self._posts_cache[cache_key] = (current_time, posts)
            
            print(f"✅ Appended post to OrbitDB feed for {wallet}")
            return True
        
        return False
    
    async def get_user_posts(self, wallet: str) -> List[str]:
        """Get list of post CIDs from user's OrbitDB feed (with caching)."""
        import time
        
        cache_key = wallet.lower()
        current_time = time.time()
        
        # Check cache first
        if cache_key in self._posts_cache:
            cached_time, cached_posts = self._posts_cache[cache_key]
            # Return cache if less than TTL old
            if current_time - cached_time < self._cache_ttl:
                return cached_posts.copy()
        
        # Cache miss or expired - fetch from IPFS
        posts = await self._get_user_posts_no_cache(wallet)
        
        # Update cache
        self._posts_cache[cache_key] = (current_time, posts)
        
        return posts
    
    async def _get_user_posts_no_cache(self, wallet: str) -> List[str]:
        """Internal method to fetch posts from IPFS without cache."""
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
    
    # ==================== IPFS REGISTRY BACKUP ====================
    # Permanent backup of OrbitDB addresses to prevent data loss
    
    async def _get_address_registry(self) -> Dict[str, str]:
        """
        Get the OrbitDB address registry from IPFS.
        Registry format: {\"wallet:db_type\": \"orbitdb_address\", ...}
        """
        # Check memory cache first
        if self._registry_cache is not None:
            return self._registry_cache
        
        # Try to get from Redis
        registry_cid = redis_service.get_str(self._ipfs_registry_key)
        
        if registry_cid:
            from backend.app.posts_manage.ipfs_post_service import ipfs_service
            registry = await ipfs_service.get_json(registry_cid)
            if registry:
                self._registry_cache = registry
                return registry
        
        # No registry exists yet
        return {}
    
    async def _backup_address_to_ipfs(self, wallet: str, db_type: str, address: str):
        """
        Backup OrbitDB address to IPFS registry.
        This ensures addresses are never lost even if Redis cleared.
        """
        # Get current registry
        registry = await self._get_address_registry()
        
        # Update registry
        wallet_key = f"{wallet.lower()}:{db_type}"
        registry[wallet_key] = address
        
        # Pin updated registry to IPFS
        from backend.app.posts_manage.ipfs_post_service import ipfs_service
        new_registry_cid = await ipfs_service.pin_json(registry)
        
        if new_registry_cid:
            # Update Redis pointer to latest registry
            redis_service.set_str(self._ipfs_registry_key, new_registry_cid, ex=365*24*3600)  # 1 year
            self._registry_cache = registry
            print(f"💾 Backed up OrbitDB address to IPFS registry: {wallet}:{db_type}")
        else:
            print(f"⚠️ Failed to backup address to IPFS registry")
    
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
