"""Pydantic schemas for authenticated session management."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class AuthSessionRead(BaseModel):
    id: uuid.UUID
    client_name: str
    user_agent: str | None = None
    ip_address: str | None = None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None
    current: bool = False

    model_config = {"from_attributes": True}


class RevokeOtherSessionsRead(BaseModel):
    revoked_count: int
