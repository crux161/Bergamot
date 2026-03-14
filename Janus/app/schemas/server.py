import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ServerRead(BaseModel):
    id: uuid.UUID
    name: str
    icon_url: str | None
    owner_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
