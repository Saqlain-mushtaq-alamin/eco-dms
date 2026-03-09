"""
Decentralized notification service.
Notification data is stored on IPFS and addressed via OrbitDB pointers,
so backend does not own persistent notification state.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from backend.app.posts_manage.ipfs_post_service import ipfs_service
from backend.app.services.orbitdb_service import orbitdb_service


class NotificationService:
    async def _get_notifications_data(self, wallet_address: str) -> Dict:
        wallet = wallet_address.lower()
        db_address = await orbitdb_service.get_db_address(wallet, "notifications")

        if not db_address:
            return {"items": []}

        parts = db_address.split("/")
        if len(parts) < 3:
            return {"items": []}

        cid = parts[2]
        data = await ipfs_service.get_json(cid)
        if not data:
            return {"items": []}

        items = data.get("items", []) if isinstance(data, dict) else []
        if not isinstance(items, list):
            items = []
        return {"items": items}

    async def _save_notifications_data(self, wallet_address: str, notifications_data: Dict) -> bool:
        wallet = wallet_address.lower()
        payload = {
            "type": "keyvalue",
            "owner": f"eth:{wallet}",
            "updated_at": datetime.utcnow().isoformat(),
            "items": notifications_data.get("items", []),
        }

        cid = await ipfs_service.pin_json(payload)
        if not cid:
            return False

        db_name = f"{wallet}.notifications"
        orbit_address = f"/orbitdb/{cid}/{db_name}"
        await orbitdb_service.set_db_address(wallet, "notifications", orbit_address)
        return True

    async def create_notification(
        self,
        recipient_wallet: str,
        event_type: str,
        message: str,
        actor_wallet: Optional[str] = None,
        post_cid: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> Optional[Dict]:
        recipient = recipient_wallet.lower()
        actor = actor_wallet.lower() if actor_wallet else None

        notification = {
            "id": str(uuid4()),
            "type": event_type,
            "message": message,
            "recipient_wallet": recipient,
            "actor_wallet": actor,
            "post_cid": post_cid,
            "metadata": metadata or {},
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        }

        current = await self._get_notifications_data(recipient)
        items = current.get("items", [])
        items.insert(0, notification)

        # Keep storage compact and fast.
        current["items"] = items[:200]
        success = await self._save_notifications_data(recipient, current)
        return notification if success else None

    async def list_notifications(self, wallet_address: str, limit: int = 30) -> List[Dict]:
        data = await self._get_notifications_data(wallet_address)
        items = data.get("items", [])
        items = sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)
        return items[:max(1, min(limit, 100))]

    async def mark_as_read(self, wallet_address: str, notification_id: str) -> bool:
        data = await self._get_notifications_data(wallet_address)
        items = data.get("items", [])
        changed = False

        for item in items:
            if item.get("id") == notification_id and not item.get("read", False):
                item["read"] = True
                changed = True
                break

        if not changed:
            return True

        data["items"] = items
        return await self._save_notifications_data(wallet_address, data)

    async def mark_all_as_read(self, wallet_address: str) -> bool:
        data = await self._get_notifications_data(wallet_address)
        items = data.get("items", [])

        changed = False
        for item in items:
            if not item.get("read", False):
                item["read"] = True
                changed = True

        if not changed:
            return True

        data["items"] = items
        return await self._save_notifications_data(wallet_address, data)


notification_service = NotificationService()
