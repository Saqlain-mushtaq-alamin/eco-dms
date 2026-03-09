from fastapi import APIRouter, Depends, HTTPException, Query

from .auth_routes import get_current_user
from .services.notification_service import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=dict)
async def get_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    wallet_address: str = Depends(get_current_user),
):
    items = await notification_service.list_notifications(wallet_address, limit)
    unread_count = sum(1 for item in items if not item.get("read", False))
    return {
        "notifications": items,
        "count": len(items),
        "unread_count": unread_count,
    }


@router.patch("/{notification_id}/read", response_model=dict)
async def mark_notification_read(
    notification_id: str,
    wallet_address: str = Depends(get_current_user),
):
    success = await notification_service.mark_as_read(wallet_address, notification_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to mark notification as read")
    return {"success": True, "notification_id": notification_id}


@router.patch("/read-all", response_model=dict)
async def mark_all_notifications_read(
    wallet_address: str = Depends(get_current_user),
):
    success = await notification_service.mark_all_as_read(wallet_address)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to mark all notifications as read")
    return {"success": True}
