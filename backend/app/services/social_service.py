"""
Social interactions service for FULLY DECENTRALIZED social media.
All data stored on IPFS (permanent, decentralized, user-owned).
Redis used ONLY as optional read cache for speed - NOT required.
If Redis unavailable, system still works (slower but 100% decentralized).

DECENTRALIZATION GUARANTEE:
- All writes go to IPFS immediately (blocking)
- Redis caches successful IPFS writes (optional speedup)
- Reads try Redis first, fall back to IPFS always
- Zero data loss even if Redis completely cleared
"""
import asyncio
import json
from typing import List, Dict, Optional
from datetime import datetime
from backend.app.posts_manage.ipfs_post_service import ipfs_service
from backend.app.services.orbitdb_service import orbitdb_service
from backend.app.services.redis_service import redis_service


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
        # Locks to prevent duplicate OrbitDB creation during concurrent requests
        self._creation_locks: Dict[str, asyncio.Lock] = {}
        # Request-level cache for social data to avoid redundant fetches
        # Format: {author_wallet: (timestamp, social_data)}
        self._social_data_cache: Dict[str, tuple[float, Dict]] = {}
        self._social_cache_ttl = 5.0  # Cache for 5 seconds during requests
        
        # Redis cache keys
        self._redis_prefix = "social:"
    
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
        import time
        
        # Check request-level cache first
        current_time = time.time()
        if author_wallet in self._social_data_cache:
            cached_time, cached_data = self._social_data_cache[author_wallet]
            if current_time - cached_time < self._social_cache_ttl:
                return cached_data.copy()
        
        social_data = await orbitdb_service.get_social_data(author_wallet)
        if social_data is None:
            # Create new social DB if doesn't exist - use lock to prevent race conditions
            # Get or create lock for this wallet
            if author_wallet not in self._creation_locks:
                self._creation_locks[author_wallet] = asyncio.Lock()
            
            async with self._creation_locks[author_wallet]:
                # Double-check after acquiring lock (another task might have created it)
                social_data = await orbitdb_service.get_social_data(author_wallet)
                if social_data is None:
                    await orbitdb_service.create_social_interactions_db(author_wallet)
                    social_data = {}
                
                # Cache the result
                self._social_data_cache[author_wallet] = (current_time, social_data)
                return social_data
        
        # Cache the result
        self._social_data_cache[author_wallet] = (current_time, social_data)
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
        Add a like to a post. FULLY DECENTRALIZED - IPFS is source of truth.
        Redis only caches the result for speed.
        Returns True if successful.
        """
        wallet = wallet_address.lower()
        
        try:
            # Get current likes from IPFS (source of truth)
            likes = await self.get_post_likes(post_cid)
            
            # Check if already liked
            if wallet in likes:
                print(f"⚠️ Post {post_cid} already liked by {wallet}")
                return True
            
            # Add the new like
            likes.append(wallet)
            
            # IMMEDIATELY write to IPFS (blocking - ensures saved!)
            likes_data = {
                "post_cid": post_cid,
                "likes": likes,
                "count": len(likes),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            new_index_cid = await ipfs_service.pin_json(likes_data)
            
            if not new_index_cid:
                print(f"❌ Failed to save like to IPFS")
                return False
            
            # Update OrbitDB index
            await self._set_likes_index_cid(post_cid, new_index_cid)
            
            # Update user's likes list
            await self._add_to_user_likes(wallet, post_cid)
            
            # OPTIONAL: Cache in Redis for faster future reads
            try:
                redis_key = f"{self._redis_prefix}likes:{post_cid}"
                redis_service.client.delete(redis_key)  # Clear old cache
                redis_service.client.sadd(redis_key, *likes)
                redis_service.client.expire(redis_key, 24 * 3600)  # 1 day cache
            except Exception:
                pass  # Redis failure is non-critical
            
            print(f"👍 Like added to IPFS (decentralized): {wallet} → {post_cid} ({len(likes)} total)")
            return True
            
            return False
        except Exception as e:
            print(f"❌ Error adding like: {e}")
            return False
    
    async def remove_like(self, post_cid: str, wallet_address: str) -> bool:
        """
        Remove a like from a post. FULLY DECENTRALIZED - IPFS is source of truth.
        """
        wallet = wallet_address.lower()
        
        try:
            # Get current likes from IPFS
            likes = await self.get_post_likes(post_cid)
            
            if wallet not in likes:
                return True  # Already not liked
            
            # Remove the like
            likes.remove(wallet)
            
            # IMMEDIATELY write to IPFS (blocking)
            likes_data = {
                "post_cid": post_cid,
                "likes": likes,
                "count": len(likes),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            new_index_cid = await ipfs_service.pin_json(likes_data)
            
            if not new_index_cid:
                return False
            
            await self._set_likes_index_cid(post_cid, new_index_cid)
            await self._remove_from_user_likes(wallet, post_cid)
            
            # OPTIONAL: Update Redis cache
            try:
                redis_key = f"{self._redis_prefix}likes:{post_cid}"
                redis_service.client.delete(redis_key)
                if likes:
                    redis_service.client.sadd(redis_key, *likes)
                    redis_service.client.expire(redis_key, 24 * 3600)
            except Exception:
                pass
            
            print(f"👎 Like removed from IPFS: {wallet} → {post_cid}")
            return True
        except Exception as e:
            print(f"❌ Error removing like: {e}")
            return False
    
    async def get_post_likes(self, post_cid: str) -> List[str]:
        """
        Get list of wallet addresses that liked this post.
        IPFS is source of truth, Redis is optional cache.
        """
        redis_key = f"{self._redis_prefix}likes:{post_cid}"
        
        try:
            # Try Redis cache first (optional speedup)
            try:
                likes_set = redis_service.client.smembers(redis_key)
                if likes_set:
                    return sorted(list(likes_set))  # type: ignore
            except Exception:
                pass  # Redis failure is non-critical
            
            # ALWAYS fall back to IPFS (source of truth)
            index_cid = await self._get_likes_index_cid(post_cid)
            if not index_cid:
                return []
            
            likes_data = await ipfs_service.get_json(index_cid)
            if not likes_data:
                return []
            
            likes = likes_data.get("likes", [])
            
            # OPTIONAL: Populate Redis cache for next time
            try:
                if likes:
                    redis_service.client.delete(redis_key)
                    redis_service.client.sadd(redis_key, *likes)
                    redis_service.client.expire(redis_key, 24 * 3600)  # 1 day
            except Exception:
                pass  # Redis failure is non-critical
            
            return likes
        except Exception as e:
            print(f"Error fetching likes from IPFS: {e}")
            return []
    
    async def get_likes_count(self, post_cid: str) -> int:
        """
        Get the number of likes for a post.
        Redis cache used if available, always falls back to IPFS.
        """
        likes = await self.get_post_likes(post_cid)
        return len(likes)
    
    async def has_user_liked(self, post_cid: str, wallet_address: str) -> bool:
        """
        Check if a user has liked a post.
        Redis cache checked first, always falls back to IPFS.
        """
        likes = await self.get_post_likes(post_cid)
        return wallet_address.lower() in likes
    
    
    # ==================== COMMENTS ====================
    
    async def add_comment(self, post_cid: str, author_wallet: str, content: str) -> Optional[str]:
        """
        Add a comment to a post. FULLY DECENTRALIZED - saves to IPFS immediately.
        Redis only caches for speed.
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
            
            # IMMEDIATELY pin comment to IPFS (blocking)
            comment_cid = await ipfs_service.pin_json(comment_data)
            
            if not comment_cid:
                return None
            
            # Get current comments from IPFS (source of truth)
            comments = await self.get_post_comments_cids(post_cid)
            
            # Add new comment
            comments.insert(0, comment_cid)  # Newest first
            
            # IMMEDIATELY update comments index in IPFS (blocking)
            comments_index = {
                "post_cid": post_cid,
                "comments": comments,
                "count": len(comments),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            new_index_cid = await ipfs_service.pin_json(comments_index)
            
            if not new_index_cid:
                return None
            
            await self._set_comments_index_cid(post_cid, new_index_cid)
            
            # OPTIONAL: Cache in Redis for faster reads
            try:
                redis_key = f"{self._redis_prefix}comments:{post_cid}"
                redis_service.client.delete(redis_key)
                redis_service.client.rpush(redis_key, *comments)
                redis_service.client.expire(redis_key, 24 * 3600)
            except Exception:
                pass  # Redis failure is non-critical
            
            print(f"💬 Comment added to IPFS (decentralized): {comment_cid} on {post_cid} ({len(comments)} total)")
            return comment_cid
        except Exception as e:
            print(f"❌ Error adding comment: {e}")
            return None
    
    async def get_post_comments_cids(self, post_cid: str) -> List[str]:
        """
        Get list of comment CIDs for a post.
        IPFS is source of truth, Redis is optional cache.
        """
        redis_key = f"{self._redis_prefix}comments:{post_cid}"
        
        try:
            # Try Redis cache first (optional)
            try:
                comments_list = redis_service.client.lrange(redis_key, 0, -1)
                if comments_list:
                    return list(comments_list)  # type: ignore
            except Exception:
                pass  # Redis failure is non-critical
            
            # ALWAYS fall back to IPFS (source of truth)
            index_cid = await self._get_comments_index_cid(post_cid)
            if not index_cid:
                return []
            
            comments_data = await ipfs_service.get_json(index_cid)
            if not comments_data:
                return []
            
            comments = comments_data.get("comments", [])
            
            # OPTIONAL: Populate Redis cache
            try:
                if comments:
                    redis_service.client.delete(redis_key)
                    redis_service.client.rpush(redis_key, *comments)
                    redis_service.client.expire(redis_key, 24 * 3600)
            except Exception:
                pass  # Redis failure is non-critical
            
            return comments
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
        IPFS is source of truth.
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
