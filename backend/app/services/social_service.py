"""
Social interactions service for decentralized social media.
Handles likes, comments, and social graph operations using IPFS.
All data is stored on IPFS - fully decentralized!
"""
import json
from typing import List, Dict, Optional
from datetime import datetime
from backend.app.posts_manage.ipfs_post_service import ipfs_service


class SocialService:
    """
    Manages social interactions (likes, comments) on IPFS.
    
    Data Structure:
    - Likes Index: {post_cid: [wallet1, wallet2, ...]}
    - Comments Index: {post_cid: [comment_cid1, comment_cid2, ...]}
    - User Likes: {wallet: [post_cid1, post_cid2, ...]}
    """
    
    def __init__(self):
        # In-memory caches for IPFS index CIDs
        self._likes_index_cache = {}  # {post_cid: index_cid}
        self._comments_index_cache = {}  # {post_cid: index_cid}
        self._user_likes_cache = {}  # {wallet: index_cid}
    
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
                self._likes_index_cache[post_cid] = new_index_cid
                
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
                self._likes_index_cache[post_cid] = new_index_cid
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
        index_cid = self._likes_index_cache.get(post_cid)
        
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
                self._comments_index_cache[post_cid] = new_index_cid
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
        index_cid = self._comments_index_cache.get(post_cid)
        
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
            index_cid = self._user_likes_cache.get(wallet)
            
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
                self._user_likes_cache[wallet] = new_index_cid
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
            index_cid = self._user_likes_cache.get(wallet)
            
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
                self._user_likes_cache[wallet] = new_index_cid
                return True
            
            return False
        except Exception as e:
            print(f"Error updating user likes: {e}")
            return False
    
    def set_likes_index_cid(self, post_cid: str, index_cid: str):
        """Manually set likes index CID (for recovery/initialization)"""
        self._likes_index_cache[post_cid] = index_cid
    
    def set_comments_index_cid(self, post_cid: str, index_cid: str):
        """Manually set comments index CID (for recovery/initialization)"""
        self._comments_index_cache[post_cid] = index_cid


social_service = SocialService()
