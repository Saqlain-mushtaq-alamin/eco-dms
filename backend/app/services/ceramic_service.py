"""
Decentralized Data Service using OrbitDB (Free, No Gas Fees!)

OrbitDB is a serverless, peer-to-peer database built on IPFS.
- No blockchain needed (no gas fees!)
- Users own their data
- Backend is just a gateway/helper
- Fully decentralized

Architecture:
1. User authenticates with wallet (SIWE)
2. Backend helps create user's OrbitDB databases
3. Data stored on IPFS, indexed by OrbitDB
4. Users can run their own IPFS nodes
5. Backend helps pin and replicate data
"""
from typing import List, Optional
from backend.app.services.orbitdb_service import orbitdb_service


class CeramicService:
    """
    Using OrbitDB for decentralized storage (Ceramic alternative).
    
    Why OrbitDB:
    - Free (no gas fees)
    - Decentralized (IPFS-based)
    - User-owned (each user has their own databases)
    - Simple (no complex setup like Ceramic)
    
    Each user has:
    - Profile database (KeyValue store)
    - Posts database (Feed/Log)
    - Social graph database (Documents)
    """
    
    def __init__(self):
        self.orbit = orbitdb_service
    
    async def get_author_posts(self, wallet_address: str) -> List[str]:
        """
        Get list of post CIDs for an author from their OrbitDB feed.
        FULLY DECENTRALIZED - data on IPFS, no central database!
        """
        wallet = wallet_address.lower()
        
        try:
            posts = await self.orbit.get_user_posts(wallet)
            return posts
        except Exception as e:
            print(f"❌ Error fetching posts from OrbitDB: {e}")
            return []

    async def append_author_post(self, wallet_address: str, cid: str) -> bool:
        """
        Append a post CID to the author's OrbitDB feed.
        The user OWNS this database - we're just helping them update it.
        FREE - no gas fees!
        """
        wallet = wallet_address.lower()
        
        try:
            # Ensure user has a posts database
            db_address = await self.orbit.get_db_address(wallet, "posts")
            if not db_address:
                # Create posts database for user
                db_address = await self.orbit.create_user_posts_db(wallet)
                if not db_address:
                    return False
            
            # Append post to feed
            success = await self.orbit.append_post(wallet, cid)
            
            if success:
                print(f"✅ Post added to OrbitDB for {wallet} (FREE, no gas!)")
                return True
            
            return False
        except Exception as e:
            print(f"❌ Error updating posts in OrbitDB: {e}")
            return False
    
    def set_index_cid(self, wallet_address: str, index_cid: str):
        """Legacy method - not needed with OrbitDB."""
        print(f"⚠️ set_index_cid is deprecated - using OrbitDB instead")
        pass

    def get_index_cid(self, wallet_address: str) -> Optional[str]:
        """Legacy method - not needed with OrbitDB."""
        print(f"⚠️ get_index_cid is deprecated - using OrbitDB instead")
        return None


ceramic_service = CeramicService()
