"""Schemas for passkey registration and authentication flows."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PasskeyRead(BaseModel):
    id: uuid.UUID
    label: str
    created_at: datetime
    last_used_at: datetime | None = None
    transports: list[str] = []


class PasskeyChallengeRead(BaseModel):
    challenge_id: str
    public_key: dict[str, Any]


class PasskeyRegistrationStart(BaseModel):
    label: str | None = Field(default=None, max_length=120)


class PasskeyRegistrationFinish(BaseModel):
    challenge_id: str
    credential: dict[str, Any]


class PasskeyAuthenticationStart(BaseModel):
    username: str | None = Field(default=None, max_length=64)


class PasskeyAuthenticationFinish(BaseModel):
    challenge_id: str
    credential: dict[str, Any]
