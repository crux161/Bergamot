import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FriendshipRead(BaseModel):
    id: uuid.UUID
    peer_id: uuid.UUID
    relationship_type: int
    nickname: str | None
    created_at: datetime
    peer_username: str | None = None
    peer_display_name: str | None = None
    peer_avatar_url: str | None = None
    peer_banner_url: str | None = None
    peer_status: str | None = None
    peer_status_message: str | None = None

    model_config = {"from_attributes": True}


class MutualServerRead(BaseModel):
    id: uuid.UUID
    name: str
    icon_url: str | None = None

    model_config = {"from_attributes": True}


class FriendRequestCreate(BaseModel):
    username: str = Field(min_length=1, max_length=32)


class FriendNicknameUpdate(BaseModel):
    nickname: str | None = Field(default=None, max_length=64)
