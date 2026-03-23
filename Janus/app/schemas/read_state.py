"""Pydantic schemas for read-state APIs."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.read_state import ReadStateTarget


class ReadStateUpdate(BaseModel):
    """Marks a message stream as read up to a specific message."""

    last_read_message_id: uuid.UUID | None = None


class ReadStateRead(BaseModel):
    """Serialized read-state plus its current unread count."""

    id: uuid.UUID
    user_id: uuid.UUID
    target_kind: ReadStateTarget
    target_id: uuid.UUID
    last_read_message_id: uuid.UUID | None = None
    last_read_at: datetime | None = None
    unread_count: int = 0
    updated_at: datetime

    model_config = {"from_attributes": True}
