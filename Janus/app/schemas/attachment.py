"""Pydantic schemas for file upload / attachment responses."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class AttachmentRead(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size: int
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}
