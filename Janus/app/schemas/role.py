"""Pydantic schemas for role CRUD operations."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    permissions: int = 0


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = None
    permissions: int | None = None
    position: int | None = None


class RoleRead(BaseModel):
    id: uuid.UUID
    name: str
    color: str | None
    permissions: int
    position: int
    is_default: bool
    server_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberRead(BaseModel):
    """Server member with their assigned role IDs."""

    id: uuid.UUID
    user_id: uuid.UUID
    server_id: uuid.UUID
    nickname: str | None
    username: str
    display_name: str | None
    avatar_url: str | None = None
    status: str = "online"
    status_message: str | None = None
    role_ids: list[uuid.UUID]

    model_config = {"from_attributes": True}
