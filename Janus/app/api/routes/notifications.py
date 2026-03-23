"""Inbox and notification routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.message_views import build_message_read
from app.core.realtime_bridge import emit_notification_read_event
from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.enums import NotificationType, StreamKind
from app.models.message import Message
from app.models.notification import Notification
from app.models.read_state import ReadState, ReadStateTarget
from app.models.server import Server
from app.models.user import User
from app.schemas.activity import (
    ActorRead,
    NotificationRead,
    NotificationSummaryRead,
    StreamContextRead,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def _build_stream_context(
    session: AsyncSession,
    *,
    current_user: User,
    stream_kind: StreamKind,
    stream_id: uuid.UUID,
) -> StreamContextRead:
    if stream_kind == StreamKind.CHANNEL:
        channel_result = await session.execute(select(Channel).where(Channel.id == stream_id))
        channel = channel_result.scalar_one_or_none()
        if channel is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

        server_result = await session.execute(select(Server).where(Server.id == channel.server_id))
        server = server_result.scalar_one_or_none()
        return StreamContextRead(
            stream_kind=stream_kind,
            stream_id=stream_id,
            server_id=server.id if server else None,
            server_name=server.name if server else None,
            channel_name=channel.name,
        )

    conv_result = await session.execute(select(DMConversation).where(DMConversation.id == stream_id))
    conversation = conv_result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    peer_id = conversation.user_b_id if conversation.user_a_id == current_user.id else conversation.user_a_id
    peer_result = await session.execute(select(User).where(User.id == peer_id))
    peer = peer_result.scalar_one_or_none()
    return StreamContextRead(
        stream_kind=stream_kind,
        stream_id=stream_id,
        peer_display_name=(peer.display_name or peer.username) if peer else "Direct Message",
    )


async def _build_notification_read(
    session: AsyncSession,
    *,
    current_user: User,
    notification: Notification,
) -> NotificationRead:
    message_payload = None
    if notification.message is not None:
        message_payload = await build_message_read(notification.message, current_user.id, session)

    stream = await _build_stream_context(
        session,
        current_user=current_user,
        stream_kind=notification.stream_kind,
        stream_id=notification.stream_id,
    )

    actor = None
    if notification.actor is not None:
        actor = ActorRead.model_validate(notification.actor)

    body = message_payload["content"] if message_payload else ""
    title = "Mention"
    if notification.notification_type == NotificationType.REPLY:
        title = "Reply"

    return NotificationRead(
        id=str(notification.id),
        notification_type=notification.notification_type,
        title=title,
        body=body,
        created_at=notification.created_at,
        read_at=notification.read_at,
        actor=actor,
        message_id=notification.message_id,
        message=message_payload,
        stream=stream,
    )


async def _list_dm_unread_summaries(
    session: AsyncSession,
    *,
    current_user: User,
) -> list[NotificationRead]:
    conv_result = await session.execute(
        select(DMConversation).where(
            (DMConversation.user_a_id == current_user.id) | (DMConversation.user_b_id == current_user.id)
        )
    )
    conversations = list(conv_result.scalars().all())
    if not conversations:
        return []

    read_state_result = await session.execute(
        select(ReadState).where(
            ReadState.user_id == current_user.id,
            ReadState.target_kind == ReadStateTarget.DM,
            ReadState.target_id.in_([conversation.id for conversation in conversations]),
        )
    )
    read_state_by_target = {state.target_id: state for state in read_state_result.scalars().all()}

    items: list[NotificationRead] = []
    for conversation in conversations:
        latest_result = await session.execute(
            select(Message)
            .options(joinedload(Message.reply_to))
            .where(Message.channel_id == conversation.id, Message.sender_id != current_user.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        latest_message = latest_result.scalar_one_or_none()
        if latest_message is None:
            continue

        read_state = read_state_by_target.get(conversation.id)
        count_statement = select(func.count(Message.id)).where(
            Message.channel_id == conversation.id,
            Message.sender_id != current_user.id,
        )
        if read_state and read_state.last_read_at is not None:
            count_statement = count_statement.where(Message.created_at > read_state.last_read_at)
        unread_count = int((await session.scalar(count_statement)) or 0)
        if unread_count <= 0:
            continue

        stream = await _build_stream_context(
            session,
            current_user=current_user,
            stream_kind=StreamKind.DM,
            stream_id=conversation.id,
        )
        message_payload = await build_message_read(latest_message, current_user.id, session)
        items.append(
            NotificationRead(
                id=f"dm:{conversation.id}",
                notification_type=NotificationType.DM_UNREAD_SUMMARY,
                title="Unread DM messages",
                body=message_payload["content"],
                created_at=latest_message.created_at,
                read_at=None,
                actor=None,
                message_id=latest_message.id,
                message=message_payload,
                stream=stream,
                unread_count=unread_count,
            )
        )
    return items


async def _build_summary(session: AsyncSession, *, current_user: User) -> NotificationSummaryRead:
    unread_notifications = int(
        (await session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.read_at.is_(None),
            )
        )) or 0
    )
    unread_mentions = int(
        (await session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.read_at.is_(None),
                Notification.notification_type == NotificationType.MENTION,
            )
        )) or 0
    )
    unread_replies = int(
        (await session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.read_at.is_(None),
                Notification.notification_type == NotificationType.REPLY,
            )
        )) or 0
    )
    dm_items = await _list_dm_unread_summaries(session, current_user=current_user)
    unread_dm_conversations = len(dm_items)
    unread_dm_messages = sum(item.unread_count or 0 for item in dm_items)

    return NotificationSummaryRead(
        total_unread=unread_notifications + unread_dm_messages,
        unread_notifications=unread_notifications,
        unread_mentions=unread_mentions,
        unread_replies=unread_replies,
        unread_dm_conversations=unread_dm_conversations,
        unread_dm_messages=unread_dm_messages,
    )


@router.get("/", response_model=list[NotificationRead])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List persisted notifications plus synthetic unread DM summaries."""
    result = await session.execute(
        select(Notification)
        .options(joinedload(Notification.actor), joinedload(Notification.message).joinedload(Message.reply_to))
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    persisted = [
        await _build_notification_read(session, current_user=current_user, notification=notification)
        for notification in result.scalars().unique().all()
    ]
    dm_items = await _list_dm_unread_summaries(session, current_user=current_user)
    items = persisted + dm_items
    items.sort(key=lambda item: item.created_at, reverse=True)
    return items


@router.get("/summary", response_model=NotificationSummaryRead)
async def get_notification_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return unread badge counts for the current user."""
    return await _build_summary(session, current_user=current_user)


@router.put("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Mark a persisted notification as read."""
    try:
        notification_uuid = uuid.UUID(notification_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid notification id") from exc

    result = await session.execute(
        select(Notification)
        .options(joinedload(Notification.actor), joinedload(Notification.message).joinedload(Message.reply_to))
        .where(Notification.id == notification_uuid, Notification.user_id == current_user.id)
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.read_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(notification)
    await emit_notification_read_event(
        session,
        user_id=current_user.id,
        notification_id=notification.id,
        read_all=False,
    )
    return await _build_notification_read(session, current_user=current_user, notification=notification)


@router.post("/read-all", response_model=NotificationSummaryRead)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Mark all persisted notifications as read and clear DM unread summaries."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
    )
    for notification in result.scalars().all():
        notification.read_at = now

    conv_result = await session.execute(
        select(DMConversation).where(
            (DMConversation.user_a_id == current_user.id) | (DMConversation.user_b_id == current_user.id)
        )
    )
    conversations = list(conv_result.scalars().all())
    for conversation in conversations:
        latest_result = await session.execute(
            select(Message)
            .where(Message.channel_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        latest_message = latest_result.scalar_one_or_none()
        if latest_message is None:
            continue

        state_result = await session.execute(
            select(ReadState).where(
                ReadState.user_id == current_user.id,
                ReadState.target_kind == ReadStateTarget.DM,
                ReadState.target_id == conversation.id,
            )
        )
        state = state_result.scalar_one_or_none()
        if state is None:
            state = ReadState(
                user_id=current_user.id,
                target_kind=ReadStateTarget.DM,
                target_id=conversation.id,
            )
            session.add(state)
        state.last_read_message_id = latest_message.id
        state.last_read_at = latest_message.created_at

    await session.commit()
    await emit_notification_read_event(
        session,
        user_id=current_user.id,
        notification_id=None,
        read_all=True,
    )
    return await _build_summary(session, current_user=current_user)
