import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class GiftCodeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    claim_message: str | None = Field(default=None, max_length=2000)
    theme: str | None = Field(default=None, max_length=128)
    expires_in_hours: int | None = Field(default=None, ge=1, le=24 * 30)


class GiftCodeRead(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    description: str | None
    claim_message: str | None
    theme: str | None
    expires_at: datetime | None
    claimed_at: datetime | None
    created_at: datetime
    claimed_by_user_id: uuid.UUID | None
    gift_url: str


class GiftCodePreviewRead(BaseModel):
    code: str
    valid: bool
    title: str
    description: str | None
    claim_message: str | None
    theme: str | None
    expires_at: datetime | None
    claimed: bool
    claimed_by_user_id: uuid.UUID | None


class GiftClaimRead(BaseModel):
    ok: bool
    already_claimed: bool = False
    title: str
    description: str | None = None
    claim_message: str | None = None
    theme: str | None = None
