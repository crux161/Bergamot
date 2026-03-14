import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.channel import ChannelType


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    channel_type: ChannelType = ChannelType.TEXT
    topic: str | None = Field(default=None, max_length=1024)


class ChannelRead(BaseModel):
    id: uuid.UUID
    name: str
    topic: str | None
    channel_type: ChannelType
    position: int
    server_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
