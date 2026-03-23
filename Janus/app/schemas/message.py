"""Pydantic schemas for chat messages."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(default="", max_length=4000)
    nonce: str | None = None
    attachments: list[dict[str, Any]] | None = None
    reply_to_id: uuid.UUID | None = None


class MessageUpdate(BaseModel):
    content: str = Field(max_length=4000)


class ReactionCount(BaseModel):
    emoji: str
    count: int
    me: bool = False


class MessageReferenceRead(BaseModel):
    """Compact representation of the replied-to message."""
    id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageRead(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    nonce: str | None
    attachments: list[dict[str, Any]] | None
    created_at: datetime

    # Reply
    reply_to_id: uuid.UUID | None = None
    reply_to: MessageReferenceRead | None = None

    # Edit
    edited_at: datetime | None = None

    # Pin
    pinned: bool = False
    pinned_at: datetime | None = None
    pinned_by: uuid.UUID | None = None

    # Reactions (aggregated)
    reaction_counts: list[ReactionCount] = []

    model_config = {"from_attributes": True}
