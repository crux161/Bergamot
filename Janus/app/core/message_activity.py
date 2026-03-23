"""Helpers for message mentions, reply notifications, and search snippets."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.enums import NotificationType, StreamKind
from app.models.message import Message
from app.models.message_mention import MessageMention
from app.models.notification import Notification
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User

MENTION_PATTERN = re.compile(r"(?<![\w@])@([A-Za-z0-9_]{1,32})")


@dataclass(slots=True, frozen=True)
class NotificationRealtimeEvent:
    user_id: uuid.UUID
    notification_type: NotificationType
    stream_kind: StreamKind
    stream_id: uuid.UUID
    message_id: uuid.UUID


@dataclass(slots=True)
class MessageActivitySyncResult:
    notification_events: list[NotificationRealtimeEvent] = field(default_factory=list)
    unread_summary_user_ids: set[uuid.UUID] = field(default_factory=set)

    def extend(self, other: "MessageActivitySyncResult") -> None:
        self.notification_events.extend(other.notification_events)
        self.unread_summary_user_ids.update(other.unread_summary_user_ids)


def extract_mentioned_usernames(content: str) -> list[str]:
    """Extract unique usernames from message content in first-seen order."""
    seen: set[str] = set()
    ordered: list[str] = []
    for match in MENTION_PATTERN.findall(content or ""):
        username = match.lower()
        if username in seen:
            continue
        seen.add(username)
        ordered.append(username)
    return ordered


def build_search_snippet(content: str, query: str, window: int = 72) -> str:
    """Build a compact content snippet centered on the first match."""
    haystack = content or ""
    needle = query.strip()
    if not haystack:
        return ""
    if not needle:
        return haystack[: window * 2].strip()

    lowered = haystack.lower()
    idx = lowered.find(needle.lower())
    if idx < 0:
        return haystack[: window * 2].strip()

    start = max(idx - window, 0)
    end = min(idx + len(needle) + window, len(haystack))
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(haystack) else ""
    return f"{prefix}{haystack[start:end].strip()}{suffix}"


async def sync_channel_message_activity(
    session: AsyncSession,
    *,
    message: Message,
    actor: User,
    channel: Channel,
) -> MessageActivitySyncResult:
    """Resolve mentions and reply notifications for a guild channel message."""
    result = MessageActivitySyncResult()
    server_result = await session.execute(select(Server).where(Server.id == channel.server_id))
    server = server_result.scalar_one()
    mentioned_users = await _resolve_channel_mentions(session, server, message.content, actor.id)
    result.extend(await _replace_mentions(
        session,
        message=message,
        actor=actor,
        stream_kind=StreamKind.CHANNEL,
        stream_id=channel.id,
        mentioned_users=mentioned_users,
    ))
    result.extend(await _ensure_reply_notification(
        session,
        message=message,
        actor=actor,
        stream_kind=StreamKind.CHANNEL,
        stream_id=channel.id,
    ))
    return result


async def sync_dm_message_activity(
    session: AsyncSession,
    *,
    message: Message,
    actor: User,
    conversation: DMConversation,
) -> MessageActivitySyncResult:
    """Resolve mentions and reply notifications for a DM message."""
    result = MessageActivitySyncResult(
        unread_summary_user_ids={
            participant_id
            for participant_id in (conversation.user_a_id, conversation.user_b_id)
            if participant_id != actor.id
        }
    )
    mentioned_users = await _resolve_dm_mentions(session, conversation, message.content, actor.id)
    result.extend(await _replace_mentions(
        session,
        message=message,
        actor=actor,
        stream_kind=StreamKind.DM,
        stream_id=conversation.id,
        mentioned_users=mentioned_users,
    ))
    result.extend(await _ensure_reply_notification(
        session,
        message=message,
        actor=actor,
        stream_kind=StreamKind.DM,
        stream_id=conversation.id,
    ))
    return result


async def _resolve_channel_mentions(
    session: AsyncSession,
    server: Server,
    content: str,
    actor_user_id: uuid.UUID,
) -> list[User]:
    usernames = extract_mentioned_usernames(content)
    if not usernames:
        return []

    result = await session.execute(
        select(User)
        .join(ServerMember, ServerMember.user_id == User.id)
        .where(
            ServerMember.server_id == server.id,
            User.id != actor_user_id,
        )
    )
    candidates = {user.username.lower(): user for user in result.scalars().all()}

    owner_result = await session.execute(select(User).where(User.id == server.owner_id))
    owner = owner_result.scalar_one_or_none()
    if owner is not None and owner.id != actor_user_id:
        candidates.setdefault(owner.username.lower(), owner)

    return [candidates[name] for name in usernames if name in candidates]


async def _resolve_dm_mentions(
    session: AsyncSession,
    conversation: DMConversation,
    content: str,
    actor_user_id: uuid.UUID,
) -> list[User]:
    usernames = extract_mentioned_usernames(content)
    if not usernames:
        return []

    result = await session.execute(
        select(User).where(
            or_(User.id == conversation.user_a_id, User.id == conversation.user_b_id),
            User.id != actor_user_id,
        )
    )
    candidates = {user.username.lower(): user for user in result.scalars().all()}
    return [candidates[name] for name in usernames if name in candidates]


async def _replace_mentions(
    session: AsyncSession,
    *,
    message: Message,
    actor: User,
    stream_kind: StreamKind,
    stream_id: uuid.UUID,
    mentioned_users: list[User],
) -> MessageActivitySyncResult:
    result = MessageActivitySyncResult()
    await session.execute(
        delete(MessageMention).where(MessageMention.message_id == message.id)
    )
    await session.execute(
        delete(Notification).where(
            Notification.message_id == message.id,
            Notification.notification_type == NotificationType.MENTION,
        )
    )

    for user in mentioned_users:
        session.add(
            MessageMention(
                message_id=message.id,
                mentioned_user_id=user.id,
            )
        )
        session.add(
            Notification(
                user_id=user.id,
                actor_id=actor.id,
                message_id=message.id,
                notification_type=NotificationType.MENTION,
                stream_kind=stream_kind,
                stream_id=stream_id,
                payload={"mentioned_username": user.username},
            )
        )
        result.notification_events.append(
            NotificationRealtimeEvent(
                user_id=user.id,
                notification_type=NotificationType.MENTION,
                stream_kind=stream_kind,
                stream_id=stream_id,
                message_id=message.id,
            )
        )
    return result


async def _ensure_reply_notification(
    session: AsyncSession,
    *,
    message: Message,
    actor: User,
    stream_kind: StreamKind,
    stream_id: uuid.UUID,
) -> MessageActivitySyncResult:
    result = MessageActivitySyncResult()
    if message.reply_to_id is None:
        await session.execute(
            delete(Notification).where(
                Notification.message_id == message.id,
                Notification.notification_type == NotificationType.REPLY,
            )
        )
        return result

    reply_result = await session.execute(select(Message).where(Message.id == message.reply_to_id))
    replied_to = reply_result.scalar_one_or_none()
    if replied_to is None or replied_to.sender_id == actor.id:
        await session.execute(
            delete(Notification).where(
                Notification.message_id == message.id,
                Notification.notification_type == NotificationType.REPLY,
            )
        )
        return result

    existing_result = await session.execute(
        select(Notification).where(
            Notification.message_id == message.id,
            Notification.user_id == replied_to.sender_id,
            Notification.notification_type == NotificationType.REPLY,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is None:
        session.add(
            Notification(
                user_id=replied_to.sender_id,
                actor_id=actor.id,
                message_id=message.id,
                notification_type=NotificationType.REPLY,
                stream_kind=stream_kind,
                stream_id=stream_id,
                payload={"reply_to_id": str(message.reply_to_id)},
            )
        )
    result.notification_events.append(
        NotificationRealtimeEvent(
            user_id=replied_to.sender_id,
            notification_type=NotificationType.REPLY,
            stream_kind=stream_kind,
            stream_id=stream_id,
            message_id=message.id,
        )
    )
    return result
