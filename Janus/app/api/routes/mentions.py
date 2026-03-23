"""Mention feed routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.routes.notifications import _build_notification_read
from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.enums import NotificationType
from app.models.message import Message
from app.models.notification import Notification
from app.models.user import User
from app.schemas.activity import MentionRead

router = APIRouter(prefix="/mentions", tags=["mentions"])


@router.get("/", response_model=list[MentionRead])
async def list_mentions(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List mention notifications for the current user."""
    result = await session.execute(
        select(Notification)
        .options(joinedload(Notification.actor), joinedload(Notification.message).joinedload(Message.reply_to))
        .where(
            Notification.user_id == current_user.id,
            Notification.notification_type == NotificationType.MENTION,
        )
        .order_by(Notification.created_at.desc())
        .limit(100)
    )

    items = []
    for notification in result.scalars().unique().all():
        rendered = await _build_notification_read(session, current_user=current_user, notification=notification)
        if rendered.message_id is None or rendered.message is None:
            continue
        items.append(
            MentionRead(
                id=rendered.id,
                created_at=rendered.created_at,
                read_at=rendered.read_at,
                actor=rendered.actor,
                message_id=rendered.message_id,
                message=rendered.message,
                stream=rendered.stream,
            )
        )
    return items
