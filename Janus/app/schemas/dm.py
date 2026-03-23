"""Pydantic schemas for DM conversations."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class DMConversationRead(BaseModel):
    id: uuid.UUID
    user_a_id: uuid.UUID
    user_b_id: uuid.UUID
    peer_id: uuid.UUID
    peer_username: str
    peer_display_name: str | None
    peer_avatar_url: str | None
    peer_status: str
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DMConversationCreate(BaseModel):
    user_id: uuid.UUID  # The other user to start a DM with
