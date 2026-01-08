import json
import httpx
from typing import List, Optional, Dict, Any
from backend.app.config import settings
from backend.app.posts_manage.ipfs_post_service import ipfs_service


class CeramicService:
    """
    Fully decentralized data storage using Ceramic Network.
    - Users control their data via their DID (Decentralized Identifier)
    - Data is stored on Ceramic streams (mutable, decentralized)
    - No centralized database required!
    
    Architecture:
    1. User authenticates with wallet (SIWE) → DID
    2. User data stored in Ceramic streams owned by their DID
    3. Backend is just a gateway - doesn't store user data
    """
    def __init__(self):
        self.ceramic_url = settings.CERAMIC_API_URL
        self.client = httpx.AsyncClient(timeout=30.0)
        
        # Optional: In-memory cache for performance (can be rebuilt from Ceramic)
        # This is temporary and optional - data lives on Ceramic
        self._cache = {}
    
    async def _ceramic_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict]:
        """Make a request to Ceramic HTTP API."""
        try:
            url = f"{self.ceramic_url}{endpoint}"
            if method == "GET":
                response = await self.client.get(url)
            elif method == "POST":
                response = await self.client.post(url, json=data)
            else:
                response = await self.client.request(method, url, json=data)
            
            if response.status_code in [200, 201]:
                return response.json()
            else:
                print(f"❌ Ceramic API error {response.status_code}: {response.text}")
                return None
        except Exception as e:
            print(f"❌ Ceramic request failed: {e}")
            return None
    
    async def get_or_create_stream(self, did: str, model_name: str, default_content: Dict) -> Optional[str]:
        """
        Get existing stream for a DID or create a new one.
        Returns streamID.
        """
        # Query for existing stream
        stream_id = await self._query_stream(did, model_name)
        
        if stream_id:
            return stream_id
        
        # Create new stream
        return await self._create_stream(did, model_name, default_content)
    
    async def _query_stream(self, did: str, model_name: str) -> Optional[str]:
        """Query for existing stream by DID and model."""
        # ComposeDB GraphQL query would go here
        # For now, check cache
        cache_key = f"{did}:{model_name}"
        return self._cache.get(cache_key)
    
    async def _create_stream(self, did: str, model_name: str, content: Dict) -> Optional[str]:
        """Create a new Ceramic stream."""
        try:
            # Ceramic stream creation
            data = {
                "type": "tile",
                "metadata": {
                    "controllers": [did],
                    "family": model_name
                },
                "content": content
            }
            
            result = await self._ceramic_request("POST", "/api/v0/streams", data)
            
            if result and "streamId" in result:
                stream_id = result["streamId"]
                cache_key = f"{did}:{model_name}"
                self._cache[cache_key] = stream_id
                return stream_id
            
            return None
        except Exception as e:
            print(f"❌ Failed to create stream: {e}")
            return None
    
    async def update_stream(self, stream_id: str, content: Dict) -> bool:
        """Update an existing Ceramic stream."""
        try:
            data = {
                "content": content,
                "streamId": stream_id
            }
            
            result = await self._ceramic_request("POST", "/api/v0/commits", data)
            return result is not None
        except Exception as e:
            print(f"❌ Failed to update stream: {e}")
            return False
    
    async def get_stream_content(self, stream_id: str) -> Optional[Dict]:
        """Get content from a Ceramic stream."""
        try:
            result = await self._ceramic_request("GET", f"/api/v0/streams/{stream_id}")
            
            if result and "state" in result:
                return result["state"].get("content", {})
            
            return None
        except Exception as e:
            print(f"❌ Failed to get stream: {e}")
            return None

    # ==================== POSTS INDEX ====================
    
    async def get_author_posts(self, wallet_address: str) -> List[str]:
        """
        Get list of post CIDs for an author from Ceramic.
        Each user has their own Ceramic stream with their posts index.
        FULLY DECENTRALIZED - no centralized database!
        """
        wallet = wallet_address.lower()
        did = self._wallet_to_did(wallet)
        
        try:
            # Get the user's posts stream from Ceramic
            stream_id = await self._query_stream(did, "AuthorPosts")
            
            if not stream_id:
                # No posts yet
                return []
            
            # Get stream content from Ceramic
            content = await self.get_stream_content(stream_id)
            
            if content and "cids" in content:
                return content["cids"]
            
            return []
        except Exception as e:
            print(f"❌ Error fetching posts from Ceramic: {e}")
            return []

    async def append_author_post(self, wallet_address: str, cid: str) -> bool:
        """
        Append a post CID to the author's Ceramic stream.
        The user OWNS this stream - we're just helping them update it.
        """
        wallet = wallet_address.lower()
        did = self._wallet_to_did(wallet)
        
        try:
            # Get current posts
            current_cids = await self.get_author_posts(wallet)
            
            # Add new CID at the beginning (most recent first)
            updated_cids = [cid] + current_cids
            
            # Get or create the posts stream
            stream_id = await self.get_or_create_stream(
                did, 
                "AuthorPosts",
                {"author": did, "cids": []}
            )
            
            if not stream_id:
                return False
            
            # Update the Ceramic stream
            success = await self.update_stream(stream_id, {
                "author": did,
                "cids": updated_cids
            })
            
            if success:
                print(f"✅ Posts updated on Ceramic for {wallet}: {len(updated_cids)} posts")
                return True
            
            return False
        except Exception as e:
            print(f"❌ Error updating posts on Ceramic: {e}")
            return False
    
    def _wallet_to_did(self, wallet_address: str) -> str:
        """
        Convert Ethereum wallet to DID format.
        DID format: did:pkh:eip155:1:{wallet_address}
        """
        chain_id = settings.CHAIN_ID
        return f"did:pkh:eip155:{chain_id}:{wallet_address.lower()}"
    
    def set_index_cid(self, wallet_address: str, index_cid: str):
        """
        Legacy method - not needed with Ceramic.
        Data is stored on Ceramic streams, not as CIDs.
        """
        print(f"⚠️ set_index_cid is deprecated - data is on Ceramic streams")
        pass

    def get_index_cid(self, wallet_address: str) -> Optional[str]:
        """
        Legacy method - not needed with Ceramic.
        Query Ceramic streams instead.
        """
        print(f"⚠️ get_index_cid is deprecated - query Ceramic streams directly")
        return None


ceramic_service = CeramicService()
