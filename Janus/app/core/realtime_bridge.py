"""Helpers for dispatching Janus-originated realtime events through Hermes."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from urllib import error, request

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.message_activity import MessageActivitySyncResult
from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.enums import NotificationType, SavedItemKind
from app.models.friendship import Friendship
from app.models.message import Message
from app.models.notification import Notification
from app.models.read_state import ReadState, ReadStateTarget
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User

logger = logging.getLogger(__name__)
FRIEND = 1


def _post_json(url: str | None, payload: dict) -> None:
    if not url:
        return

    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Hermes-Internal-Secret": settings.HERMES_INTERNAL_SECRET,
        },
    )
    with request.urlopen(req, timeout=5):
        return


async def dispatch_user_event(user_id: uuid.UUID, event: str, payload: dict) -> None:
    """Send a user-scoped realtime event to Hermes if configured."""
    if not settings.HERMES_INTERNAL_URL:
        return

    try:
        await asyncio.to_thread(
            _post_json,
            settings.HERMES_INTERNAL_URL,
            {
                "user_id": str(user_id),
                "event": event,
                "payload": payload,
            },
        )
    except (error.URLError, TimeoutError, OSError) as exc:
        logger.warning("Failed to dispatch Hermes realtime event %s for %s: %s", event, user_id, exc)


async def publish_domain_event(topic: str, partition_key: str, event: dict) -> None:
    """Publish a canonical Janus-originated event into Kafka through Hermes."""
    if not settings.HERMES_INTERNAL_PUBLISH_URL:
        return

    try:
        await asyncio.to_thread(
            _post_json,
            settings.HERMES_INTERNAL_PUBLISH_URL,
            {
                "topic": topic,
                "partition_key": partition_key,
                "event": event,
            },
        )
    except (error.URLError, TimeoutError, OSError) as exc:
        logger.warning(
            "Failed to publish domain event %s to topic %s: %s",
            event.get("event_type"),
            topic,
            exc,
        )


async def _build_unread_summary_payload(session: AsyncSession, user_id: uuid.UUID) -> dict:
    unread_notifications = int(
        (await session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
            )
        )) or 0
    )
    unread_mentions = int(
        (await session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
                Notification.notification_type == NotificationType.MENTION,
            )
        )) or 0
    )
    unread_replies = int(
        (await session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
                Notification.notification_type == NotificationType.REPLY,
            )
        )) or 0
    )

    conv_result = await session.execute(
        select(DMConversation).where(
            (DMConversation.user_a_id == user_id) | (DMConversation.user_b_id == user_id)
        )
    )
    conversations = list(conv_result.scalars().all())
    unread_dm_conversations = 0
    unread_dm_messages = 0

    if conversations:
        read_state_result = await session.execute(
            select(ReadState).where(
                ReadState.user_id == user_id,
                ReadState.target_kind == ReadStateTarget.DM,
                ReadState.target_id.in_([conversation.id for conversation in conversations]),
            )
        )
        read_states = {state.target_id: state for state in read_state_result.scalars().all()}

        for conversation in conversations:
            statement = select(func.count(Message.id)).where(
                Message.channel_id == conversation.id,
                Message.sender_id != user_id,
            )
            state = read_states.get(conversation.id)
            if state and state.last_read_at is not None:
                statement = statement.where(Message.created_at > state.last_read_at)
            unread_count = int((await session.scalar(statement)) or 0)
            if unread_count > 0:
                unread_dm_conversations += 1
                unread_dm_messages += unread_count

    return {
        "total_unread": unread_notifications + unread_dm_messages,
        "unread_notifications": unread_notifications,
        "unread_mentions": unread_mentions,
        "unread_replies": unread_replies,
        "unread_dm_conversations": unread_dm_conversations,
        "unread_dm_messages": unread_dm_messages,
    }


async def emit_unread_count_updated(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    reason: str,
    target_kind: str | None = None,
    target_id: uuid.UUID | None = None,
) -> None:
    """Broadcast a fresh unread-count summary to the user."""
    payload = {
        "summary": await _build_unread_summary_payload(session, user_id),
        "reason": reason,
    }
    if target_kind is not None:
        payload["target_kind"] = target_kind
    if target_id is not None:
        payload["target_id"] = str(target_id)
    await dispatch_user_event(user_id, "unread_count_updated", payload)


async def emit_read_state_domain_event(
    *,
    user_id: uuid.UUID,
    target_kind: str,
    target_id: uuid.UUID,
    last_read_message_id: uuid.UUID | None,
    last_read_at: datetime | None,
    updated_at: datetime | None,
) -> None:
    """Publish a canonical read-state event for derived systems."""
    await publish_domain_event(
        "bergamot.activity",
        str(target_id),
        {
            "event_type": "read_state_updated",
            "user_id": str(user_id),
            "target_kind": target_kind,
            "target_id": str(target_id),
            "last_read_message_id": str(last_read_message_id) if last_read_message_id is not None else None,
            "last_read_at": _serialize_timestamp(last_read_at),
            "updated_at": _serialize_timestamp(updated_at),
            "occurred_at": _serialize_timestamp(datetime.now(timezone.utc)),
        },
    )


def _serialize_timestamp(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


async def _resolve_channel_recipients(
    session: AsyncSession,
    *,
    channel: Channel,
    actor_id: uuid.UUID,
) -> list[uuid.UUID]:
    member_result = await session.execute(
        select(ServerMember.user_id).where(ServerMember.server_id == channel.server_id)
    )
    recipients = {row[0] for row in member_result.all() if row[0] != actor_id}

    owner_result = await session.execute(select(Server.owner_id).where(Server.id == channel.server_id))
    owner_id = owner_result.scalar_one_or_none()
    if owner_id is not None and owner_id != actor_id:
        recipients.add(owner_id)
    return [recipient for recipient in recipients]


async def _build_message_event(
    session: AsyncSession,
    *,
    event_type: str,
    message: Message,
    sender: User,
    stream_kind: str,
    stream_id: uuid.UUID,
    actor: User | None = None,
    channel: Channel | None = None,
    conversation: DMConversation | None = None,
    deleted_at: datetime | None = None,
) -> tuple[str, dict]:
    acting_user = actor or sender
    if stream_kind == "channel":
        if channel is None:
            channel_result = await session.execute(select(Channel).where(Channel.id == stream_id))
            channel = channel_result.scalar_one()
        server_result = await session.execute(select(Server).where(Server.id == channel.server_id))
        server = server_result.scalar_one_or_none()
        recipient_user_ids = [
            str(user_id)
            for user_id in await _resolve_channel_recipients(
                session,
                channel=channel,
                actor_id=acting_user.id,
            )
        ]
        partition_key = str(channel.id)
        stream_payload = {
            "stream_kind": "channel",
            "stream_id": str(channel.id),
            "server_id": str(channel.server_id),
            "server_name": server.name if server else None,
            "channel_name": channel.name,
        }
    else:
        if conversation is None:
            conv_result = await session.execute(select(DMConversation).where(DMConversation.id == stream_id))
            conversation = conv_result.scalar_one()
        recipient_user_ids = [
            str(user_id)
            for user_id in (conversation.user_a_id, conversation.user_b_id)
            if user_id != acting_user.id
        ]
        partition_key = str(conversation.id)
        stream_payload = {
            "stream_kind": "dm",
            "stream_id": str(conversation.id),
            "server_id": None,
            "server_name": None,
            "channel_name": None,
        }

    event = {
        "event_type": event_type,
        "message": {
            "id": str(message.id),
            "content": message.content,
            "attachments": message.attachments or [],
            "reply_to_id": str(message.reply_to_id) if message.reply_to_id is not None else None,
            "created_at": _serialize_timestamp(message.created_at),
            "edited_at": _serialize_timestamp(message.edited_at),
            "deleted_at": _serialize_timestamp(deleted_at),
            "sender_id": str(sender.id),
            "sender_username": sender.username,
            "sender_display_name": sender.display_name,
            **stream_payload,
        },
        "actor": {
            "id": str(acting_user.id),
            "username": acting_user.username,
            "display_name": acting_user.display_name,
        },
        "recipient_user_ids": recipient_user_ids,
        "occurred_at": _serialize_timestamp(datetime.now(timezone.utc)),
    }
    return partition_key, event


async def emit_message_domain_event(
    session: AsyncSession,
    *,
    event_type: str,
    message: Message,
    sender: User,
    stream_kind: str,
    stream_id: uuid.UUID,
    actor: User | None = None,
    channel: Channel | None = None,
    conversation: DMConversation | None = None,
    deleted_at: datetime | None = None,
) -> None:
    """Publish a canonical message lifecycle event for derived systems."""
    partition_key, event = await _build_message_event(
        session,
        event_type=event_type,
        message=message,
        sender=sender,
        stream_kind=stream_kind,
        stream_id=stream_id,
        actor=actor,
        channel=channel,
        conversation=conversation,
        deleted_at=deleted_at,
    )
    await publish_domain_event("bergamot.activity", partition_key, event)


async def emit_message_activity_events(
    session: AsyncSession,
    *,
    sync_result: MessageActivitySyncResult,
    reason: str,
) -> None:
    """Broadcast mention/reply creation and unread-summary changes."""
    summary_recipients: set[uuid.UUID] = set(sync_result.unread_summary_user_ids)

    seen_notifications: set[tuple[uuid.UUID, str, uuid.UUID]] = set()
    for event in sync_result.notification_events:
        dedupe_key = (event.user_id, event.notification_type.value, event.message_id)
        if dedupe_key in seen_notifications:
            continue
        seen_notifications.add(dedupe_key)
        await dispatch_user_event(
            event.user_id,
            "notification_created",
            {
                "notification_type": event.notification_type.value,
                "message_id": str(event.message_id),
                "stream_kind": event.stream_kind.value,
                "stream_id": str(event.stream_id),
                "reason": reason,
            },
        )
        await publish_domain_event(
            "bergamot.activity",
            str(event.user_id),
            {
                "event_type": "notification_created",
                "user_id": str(event.user_id),
                "notification_type": event.notification_type.value,
                "message_id": str(event.message_id),
                "stream_kind": event.stream_kind.value,
                "stream_id": str(event.stream_id),
                "occurred_at": _serialize_timestamp(datetime.now(timezone.utc)),
                "reason": reason,
            },
        )
        summary_recipients.add(event.user_id)

    for user_id in summary_recipients:
        await emit_unread_count_updated(session, user_id=user_id, reason=reason)


async def emit_notification_read_event(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    notification_id: uuid.UUID | None,
    read_all: bool = False,
) -> None:
    """Broadcast notification read changes and the updated summary."""
    await dispatch_user_event(
        user_id,
        "notification_read",
        {
            "notification_id": str(notification_id) if notification_id is not None else None,
            "read_all": read_all,
        },
    )
    await publish_domain_event(
        "bergamot.activity",
        str(user_id),
        {
            "event_type": "notification_read",
            "user_id": str(user_id),
            "notification_id": str(notification_id) if notification_id is not None else None,
            "read_all": read_all,
            "occurred_at": _serialize_timestamp(datetime.now(timezone.utc)),
        },
    )
    await emit_unread_count_updated(session, user_id=user_id, reason="notification_read")


async def emit_saved_item_updated(
    *,
    user_id: uuid.UUID,
    kind: SavedItemKind,
    target_id: uuid.UUID,
    action: str,
) -> None:
    """Broadcast that a saved item was added or removed."""
    await dispatch_user_event(
        user_id,
        "saved_item_updated",
        {
            "kind": kind.value,
            "target_id": str(target_id),
            "action": action,
        },
    )


async def emit_relationship_presence_updated(
    session: AsyncSession,
    *,
    user: User,
) -> None:
    """Send a presence-shaped update to the user's friends."""
    result = await session.execute(
        select(Friendship.peer_id).where(
            Friendship.user_id == user.id,
            Friendship.relationship_type == FRIEND,
        )
    )
    friend_ids = [row[0] for row in result.all()]
    payload = {
        "user_id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "status": user.status,
        "status_message": user.status_message,
    }
    for friend_id in friend_ids:
        await dispatch_user_event(friend_id, "relationship_presence_updated", payload)
    await publish_domain_event(
        "bergamot.activity",
        str(user_id),
        {
            "event_type": "saved_item_updated",
            "user_id": str(user_id),
            "kind": kind.value,
            "target_id": str(target_id),
            "action": action,
            "occurred_at": _serialize_timestamp(datetime.now(timezone.utc)),
        },
    )
