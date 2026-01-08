"""
Social interactions service for decentralized social media.
Handles likes, comments, and social graph operations using IPFS + OrbitDB.
All data is stored on IPFS - fully decentralized!
Index CIDs stored in post author's OrbitDB (no centralized Redis!).
"""
import json
from typing import List, Dict, Optional
from datetime import datetime
from backend.app.posts_manage.ipfs_post_service import ipfs_service
from backend.app.services.orbitdb_service import orbitdb_service


class SocialService:
    """
    Manages social interactions (likes, comments) on IPFS + OrbitDB.
    
    Data Structure:
    - Likes Index: {post_cid: [wallet1, wallet2, ...]} → stored on IPFS
    - Comments Index: {post_cid: [comment_cid1, comment_cid2, ...]} → stored on IPFS
    - User Likes: {wallet: [post_cid1, post_cid2, ...]} → stored on IPFS
    
    Index CID mappings stored in post author's OrbitDB:
    - post_author.social -> {post_cid: {\"likes_index_cid\": \"...\", \"comments_index_cid\": \"...\"}}
    
    Fully decentralized - users own their social interaction data!
    """
    
    def __init__(self):
        # Cache for post author mapping: {post_cid: author_wallet}
        self._post_author_cache: Dict[str, str] = {}
    
    def set_post_author(self, post_cid: str, author_wallet: str):
        """Register who authored a post (needed to know which OrbitDB to update)."""
        self._post_author_cache[post_cid] = author_wallet.lower()
    
    async def _get_post_author(self, post_cid: str) -> Optional[str]:
        """Get the author wallet for a post. Required to know which OrbitDB to query."""
        if post_cid in self._post_author_cache:
            return self._post_author_cache[post_cid]
        
        # Try to fetch from IPFS post metadata
        post_data = await ipfs_service.get_json(post_cid)
        if post_data:
            # Check for "author" field first (new posts), then "author_wallet" (old posts)
            author = post_data.get("author") or post_data.get("author_wallet")
            if author:
                author = author.lower()
                self._post_author_cache[post_cid] = author
                return author
        
        return None
    
    async def _get_social_data_for_author(self, author_wallet: str) -> Dict:
        """Get all social interactions data for a user's posts from their OrbitDB."""
        social_data = await orbitdb_service.get_social_data(author_wallet)
        if social_data is None:
            # Create new social DB if doesn't exist
            await orbitdb_service.create_social_interactions_db(author_wallet)
            return {}
        return social_data
    
    async def _update_social_data_for_author(self, author_wallet: str, social_data: Dict) -> bool:
        """Update social interactions data in author's OrbitDB."""
        return await orbitdb_service.update_social_data(author_wallet, social_data)
    
    async def _get_likes_index_cid(self, post_cid: str) -> Optional[str]:
        """Get likes index CID from post author's OrbitDB."""
        author = await self._get_post_author(post_cid)
        if not author:
            return None
        
        social_data = await self._get_social_data_for_author(author)
        if post_cid in social_data and "likes_index_cid" in social_data[post_cid]:
            return social_data[post_cid]["likes_index_cid"]
        return None
    
    async def _set_likes_index_cid(self, post_cid: str, index_cid: str):
        """Store likes index CID in post author's OrbitDB."""
        author = await self._get_post_author(post_cid)
        if not author:
            print(f"⚠️ Cannot set likes index: unknown author for post {post_cid}")
            return
        
        social_data = await self._get_social_data_for_author(author)
        if post_cid not in social_data:
            social_data[post_cid] = {}
        social_data[post_cid]["likes_index_cid"] = index_cid
        
        await self._update_social_data_for_author(author, social_data)
    
    async def _get_comments_index_cid(self, post_cid: str) -> Optional[str]:
        """Get comments index CID from post author's OrbitDB."""
        author = await self._get_post_author(post_cid)
        if not author:
            return None
        
        social_data = await self._get_social_data_for_author(author)
        if post_cid in social_data and "comments_index_cid" in social_data[post_cid]:
            return social_data[post_cid]["comments_index_cid"]
        return None
    
    async def _set_comments_index_cid(self, post_cid: str, index_cid: str):
        """Store comments index CID in post author's OrbitDB."""
        author = await self._get_post_author(post_cid)
        if not author:
            print(f"⚠️ Cannot set comments index: unknown author for post {post_cid}")
            return
        
        social_data = await self._get_social_data_for_author(author)
        if post_cid not in social_data:
            social_data[post_cid] = {}
        social_data[post_cid]["comments_index_cid"] = index_cid
        
        await self._update_social_data_for_author(author, social_data)
    
    async def _get_user_likes_index_cid(self, wallet: str) -> Optional[str]:
        """Get user likes index CID from their own OrbitDB."""
        social_data = await self._get_social_data_for_author(wallet)
        if "user_likes_index" in social_data:
            return social_data["user_likes_index"]
        return None
    
    async def _set_user_likes_index_cid(self, wallet: str, index_cid: str):
        """Store user likes index CID in their own OrbitDB."""
        social_data = await self._get_social_data_for_author(wallet)
        social_data["user_likes_index"] = index_cid
        await self._update_social_data_for_author(wallet, social_data)
    
    # ==================== LIKES ====================
    
    async def add_like(self, post_cid: str, wallet_address: str) -> bool:
        """
        Add a like to a post. Stores the like on IPFS.
        Returns True if successful.
        """
        wallet = wallet_address.lower()
        
        try:
            # Get current likes for this post
            likes = await self.get_post_likes(post_cid)
            
            # Check if already liked
            if wallet in likes:
                print(f"⚠️ Post {post_cid} already liked by {wallet}")
                return True  # Already liked, return success
            
            # Add the new like
            likes.append(wallet)
            
            # Create updated likes index
            likes_data = {
                "post_cid": post_cid,
                "likes": likes,
                "count": len(likes),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Pin to IPFS
            new_index_cid = await ipfs_service.pin_json(likes_data)
            
            if new_index_cid:
                await self._set_likes_index_cid(post_cid, new_index_cid)
                
                # Also update user's likes list
                await self._add_to_user_likes(wallet, post_cid)
                
                print(f"👍 Like added: {wallet} → {post_cid} ({len(likes)} total likes)")
                return True
            
            return False
        except Exception as e:
            print(f"❌ Error adding like: {e}")
            return False
    
    async def remove_like(self, post_cid: str, wallet_address: str) -> bool:
        """
        Remove a like from a post.
        """
        wallet = wallet_address.lower()
        
        try:
            likes = await self.get_post_likes(post_cid)
            
            if wallet not in likes:
                return True  # Already not liked
            
            # Remove the like
            likes.remove(wallet)
            
            # Update index
            likes_data = {
                "post_cid": post_cid,
                "likes": likes,
                "count": len(likes),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            new_index_cid = await ipfs_service.pin_json(likes_data)
            
            if new_index_cid:
                await self._set_likes_index_cid(post_cid, new_index_cid)
                await self._remove_from_user_likes(wallet, post_cid)
                print(f"👎 Like removed: {wallet} → {post_cid}")
                return True
            
            return False
        except Exception as e:
            print(f"❌ Error removing like: {e}")
            return False
    
    async def get_post_likes(self, post_cid: str) -> List[str]:
        """
        Get list of wallet addresses that liked this post.
        """
        index_cid = await self._get_likes_index_cid(post_cid)
        
        if not index_cid:
            return []
        
        try:
            likes_data = await ipfs_service.get_json(index_cid)
            if not likes_data:
                return []
            
            return likes_data.get("likes", [])
        except Exception as e:
            print(f"Error fetching likes: {e}")
            return []
    
    async def get_likes_count(self, post_cid: str) -> int:
        """
        Get the number of likes for a post.
        """
        likes = await self.get_post_likes(post_cid)
        return len(likes)
    
    async def has_user_liked(self, post_cid: str, wallet_address: str) -> bool:
        """
        Check if a user has liked a post.
        """
        likes = await self.get_post_likes(post_cid)
        return wallet_address.lower() in likes
    
    # ==================== COMMENTS ====================
    
    async def add_comment(self, post_cid: str, author_wallet: str, content: str) -> Optional[str]:
        """
        Add a comment to a post. Returns comment CID if successful.
        """
        try:
            # Create comment object
            comment_data = {
                "type": "comment",
                "version": 1,
                "post_cid": post_cid,
                "author_wallet": author_wallet.lower(),
                "content": content,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Pin comment to IPFS
            comment_cid = await ipfs_service.pin_json(comment_data)
            
            if not comment_cid:
                return None
            
            # Get current comments for this post
            comments = await self.get_post_comments_cids(post_cid)
            
            # Add new comment CID
            comments.append(comment_cid)
            
            # Update comments index
            comments_index = {
                "post_cid": post_cid,
                "comments": comments,
                "count": len(comments),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Pin updated index
            new_index_cid = await ipfs_service.pin_json(comments_index)
            
            if new_index_cid:
                await self._set_comments_index_cid(post_cid, new_index_cid)
                print(f"💬 Comment added: {comment_cid} on post {post_cid}")
                return comment_cid
            
            return None
        except Exception as e:
            print(f"❌ Error adding comment: {e}")
            return None
    
    async def get_post_comments_cids(self, post_cid: str) -> List[str]:
        """
        Get list of comment CIDs for a post.
        """
        index_cid = await self._get_comments_index_cid(post_cid)
        
        if not index_cid:
            return []
        
        try:
            comments_data = await ipfs_service.get_json(index_cid)
            if not comments_data:
                return []
            
            return comments_data.get("comments", [])
        except Exception:
            return []
    
    async def get_post_comments(self, post_cid: str) -> List[Dict]:
        """
        Get full comment objects for a post.
        """
        comment_cids = await self.get_post_comments_cids(post_cid)
        
        comments = []
        for cid in comment_cids:
            try:
                comment = await ipfs_service.get_json(cid)
                if comment:
                    comment["cid"] = cid
                    comments.append(comment)
            except Exception:
                continue
        
        return comments
    
    async def get_comments_count(self, post_cid: str) -> int:
        """
        Get the number of comments on a post.
        """
        comments = await self.get_post_comments_cids(post_cid)
        return len(comments)
    
    # ==================== HELPER METHODS ====================
    
    async def _add_to_user_likes(self, wallet: str, post_cid: str) -> bool:
        """
        Add a post to user's liked posts list.
        """
        try:
            index_cid = await self._get_user_likes_index_cid(wallet)
            
            if index_cid:
                data = await ipfs_service.get_json(index_cid)
                liked_posts = data.get("liked_posts", []) if data else []
            else:
                liked_posts = []
            
            if post_cid not in liked_posts:
                liked_posts.insert(0, post_cid)
            
            new_data = {
                "wallet": wallet,
                "liked_posts": liked_posts,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            new_index_cid = await ipfs_service.pin_json(new_data)
            if new_index_cid:
                await self._set_user_likes_index_cid(wallet, new_index_cid)
                return True
            
            return False
        except Exception as e:
            print(f"Error updating user likes: {e}")
            return False
    
    async def _remove_from_user_likes(self, wallet: str, post_cid: str) -> bool:
        """
        Remove a post from user's liked posts list.
        """
        try:
            index_cid = await self._get_user_likes_index_cid(wallet)
            
            if not index_cid:
                return True
            
            data = await ipfs_service.get_json(index_cid)
            liked_posts = data.get("liked_posts", []) if data else []
            
            if post_cid in liked_posts:
                liked_posts.remove(post_cid)
            
            new_data = {
                "wallet": wallet,
                "liked_posts": liked_posts,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            new_index_cid = await ipfs_service.pin_json(new_data)
            if new_index_cid:
                await self._set_user_likes_index_cid(wallet, new_index_cid)
                return True
            
            return False
        except Exception as e:
            print(f"Error updating user likes: {e}")
            return False
    
    async def set_likes_index_cid(self, post_cid: str, index_cid: str):
        """Manually set likes index CID (for recovery/initialization)"""
        await self._set_likes_index_cid(post_cid, index_cid)
    
    async def set_comments_index_cid(self, post_cid: str, index_cid: str):
        """Manually set comments index CID (for recovery/initialization)"""
        await self._set_comments_index_cid(post_cid, index_cid)


social_service = SocialService()
