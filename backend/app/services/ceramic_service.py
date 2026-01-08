"""
Posts Index Service using OrbitDB (FREE, No Gas Fees!)

This service manages the posts index for users using OrbitDB.
OrbitDB is a serverless, peer-to-peer database built on IPFS.

Why OrbitDB:
- Free (no gas fees)
- Decentralized (IPFS-based)
- User-owned (each user has their own databases)
- Simple (no blockchain complexity)

Note: This file kept as 'ceramic_service.py' for backwards compatibility.
Actual implementation uses OrbitDB.
"""
from typing import List, Optional
from backend.app.services.orbitdb_service import orbitdb_service


class PostsIndexService:
    """
    Manages posts index using OrbitDB.
    
    Each user has:
    - Posts database (Feed/Log) - append-only list of post CIDs
    
    FREE - no gas fees!
    DECENTRALIZED - data on IPFS via OrbitDB
    USER-OWNED - users control their data
    """
    
    def __init__(self):
        self.orbit = orbitdb_service
    
    async def get_author_posts(self, wallet_address: str) -> List[str]:
        """
        Get list of post CIDs for an author from their OrbitDB feed.
        FULLY DECENTRALIZED - data on IPFS, no central database!
        FREE - no gas fees!
        """
        return await self.orbit.get_user_posts(wallet_address.lower())

    async def append_author_post(self, wallet_address: str, cid: str) -> bool:
        """
        Append a post CID to the author's OrbitDB feed.
        The user OWNS this database - we're just helping them update it.
        FREE - no gas fees!
        """
        return await self.orbit.append_post(wallet_address.lower(), cid)
    
    # Legacy methods (not needed anymore)
    def set_index_cid(self, wallet_address: str, index_cid: str):
        """Deprecated - OrbitDB handles this automatically."""
        pass

    def get_index_cid(self, wallet_address: str) -> Optional[str]:
        """Deprecated - OrbitDB handles this automatically."""
        return None


# Export as ceramic_service for backwards compatibility
ceramic_service = PostsIndexService()
