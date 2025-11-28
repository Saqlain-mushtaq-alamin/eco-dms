"""
User Service - manages user profiles in IPFS.
Replaces database queries with IPFS operations.
"""
import os, sys
from typing import Optional, List
from datetime import datetime
from backend.app.models import UserProfile
from backend.app.services.ipfs_service import ipfs_service
from backend.app.services.pinata_service import pinata_service
from backend.app.services.redis_service import redis_service

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class UserService:
    def __init__(self):
        pass  # Redis-backed; no in-memory map

    def _cid_key(self, addr: str) -> str:
        return f"user:profile:cid:{addr.lower()}"

    async def get_or_create_profile(self, wallet_address: str) -> tuple[UserProfile, Optional[str]]:
        addr = wallet_address.lower()
        cid = redis_service.get_str(self._cid_key(addr))
        if cid:
            data = ipfs_service.get_json(cid)
            if data:
                return (UserProfile(**data), cid)
        # default minimal profile
        profile = UserProfile(wallet_address=addr, followers=[], following=[])
        new_cid = await self.save_profile(profile)
        return (profile, new_cid)

    async def save_profile(self, profile: UserProfile) -> Optional[str]:
        data = profile.model_dump() if hasattr(profile, "model_dump") else dict(profile)
        now = datetime.utcnow().isoformat() + "Z"
        data["updated_at"] = now
        if not data.get("created_at"):
            data["created_at"] = now
        cid = ipfs_service.add_json(data)
        if not cid:
            return None
        try:
            pinata_service.pin_by_cid(cid)
        except Exception:
            pass
        redis_service.set_str(self._cid_key(data["wallet_address"]), cid, ex=24*3600)
        return cid

    async def get_profile(self, wallet_address: str) -> Optional[UserProfile]:
        addr = wallet_address.lower()
        cid = redis_service.get_str(self._cid_key(addr))
        if not cid:
            return None
        data = ipfs_service.get_json(cid)
        return UserProfile(**data) if data else None

    async def update_profile(self, wallet_address: str, username: Optional[str]=None, bio: Optional[str]=None, avatar_cid: Optional[str]=None) -> Optional[str]:
        prof, _ = await self.get_or_create_profile(wallet_address)
        if username is not None: prof.username = username
        if bio is not None: prof.bio = bio
        if avatar_cid is not None: prof.avatar_cid = avatar_cid
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

user_service = UserService()