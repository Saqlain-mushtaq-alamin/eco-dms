import json
from typing import List, Optional
from backend.app.posts_manage.ipfs_post_service import ipfs_service


class CeramicService:
    """
    Pure IPFS-based decentralized index for posts.
    Stores the author's posts index as a JSON file on IPFS/Pinata.
    Each author has an index CID that points to their list of post CIDs.
    This is fully decentralized - no centralized database needed!
    """
    def __init__(self):
        # In-memory cache: {wallet_address: index_cid}
        # This stores the current index CID for each wallet
        self._index_cache = {}

    async def get_author_posts(self, wallet_address: str) -> List[str]:
        """
        Get list of post CIDs for an author from IPFS.
        The index is stored on IPFS as a JSON file containing the list of CIDs.
        """
        wallet = wallet_address.lower()
        
        # Check if we have the index CID cached
        index_cid = self._index_cache.get(wallet)
        
        if not index_cid:
            # No index yet, return empty list
            return []
        
        try:
            # Fetch the index from IPFS
            index_data = await ipfs_service.get_json(index_cid)
            if not index_data:
                return []
            
            cids = index_data.get("cids", [])
            return cids if isinstance(cids, list) else []
        except Exception as e:
            print(f"Error fetching posts index from IPFS: {e}")
            return []

    async def append_author_post(self, wallet_address: str, cid: str) -> bool:
        """
        Append a post CID to the author's index and store the updated index on IPFS.
        This creates a new version of the index file on IPFS.
        Returns True if successful, False otherwise.
        """
        wallet = wallet_address.lower()
        
        try:
            # Get current posts list
            current_cids = await self.get_author_posts(wallet)
            
            # Add new CID at the beginning (most recent first)
            updated_cids = [cid] + current_cids
            
            # Create the updated index
            index_data = {
                "author_wallet": wallet,
                "cids": updated_cids,
                "version": len(updated_cids),
                "updated_at": None  # ipfs_service will add timestamp
            }
            
            # Pin the updated index to IPFS/Pinata
            new_index_cid = await ipfs_service.pin_json(index_data)
            
            if new_index_cid:
                # Update the cache with the new index CID
                self._index_cache[wallet] = new_index_cid
                print(f"✅ Posts index updated for {wallet}: {new_index_cid} ({len(updated_cids)} posts)")
                return True
            
            return False
        except Exception as e:
            print(f"❌ Error updating posts index on IPFS: {e}")
            return False

    def set_index_cid(self, wallet_address: str, index_cid: str):
        """
        Manually set the index CID for a wallet (used for initialization or recovery).
        This is useful when you know the index CID from an external source.
        """
        self._index_cache[wallet_address.lower()] = index_cid
        print(f"📌 Index CID set for {wallet_address.lower()}: {index_cid}")

    def get_index_cid(self, wallet_address: str) -> Optional[str]:
        """
        Get the current index CID for a wallet.
        Returns None if no index exists yet.
        """
        return self._index_cache.get(wallet_address.lower())

ceramic_service = CeramicService()
