"""Pydantic schemas for chat messages."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(default="", max_length=4000)
    nonce: str | None = None
    attachments: list[dict[str, Any]] | None = None


class MessageRead(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    nonce: str | None
    attachments: list[dict[str, Any]] | None
    created_at: datetime

    model_config = {"from_attributes": True}
