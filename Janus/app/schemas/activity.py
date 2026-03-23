"""Schemas for notifications, mentions, saved items, and search."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import NotificationType, SavedItemKind, StreamKind
from app.schemas.message import MessageRead


class ActorRead(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None = None
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class StreamContextRead(BaseModel):
    stream_kind: StreamKind
    stream_id: uuid.UUID
    server_id: uuid.UUID | None = None
    server_name: str | None = None
    channel_name: str | None = None
    peer_display_name: str | None = None


class NotificationRead(BaseModel):
    id: str
    notification_type: NotificationType
    title: str
    body: str
    created_at: datetime
    read_at: datetime | None = None
    actor: ActorRead | None = None
    message_id: uuid.UUID | None = None
    message: MessageRead | None = None
    stream: StreamContextRead
    unread_count: int | None = None


class NotificationSummaryRead(BaseModel):
    total_unread: int
    unread_notifications: int
    unread_mentions: int
    unread_replies: int
    unread_dm_conversations: int
    unread_dm_messages: int


class MentionRead(BaseModel):
    id: str
    created_at: datetime
    read_at: datetime | None = None
    actor: ActorRead | None = None
    message_id: uuid.UUID
    message: MessageRead
    stream: StreamContextRead


class SavedItemRead(BaseModel):
    id: str
    kind: SavedItemKind
    target_id: uuid.UUID
    label: str
    subtitle: str
    route_hash: str
    icon: str
    created_at: datetime


class MessageSearchResultRead(BaseModel):
    id: str
    cursor: str
    snippet: str
    message: MessageRead
    stream: StreamContextRead


class SearchResultsPageRead(BaseModel):
    items: list[MessageSearchResultRead]
    next_cursor: str | None = None
