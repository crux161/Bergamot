import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ServerInviteCreate(BaseModel):
    label: str | None = Field(default=None, max_length=96)
    notes: str | None = Field(default=None, max_length=2000)
    max_uses: int | None = Field(default=None, ge=1, le=10000)
    expires_in_hours: int | None = Field(default=None, ge=1, le=24 * 30)


class ServerInviteRead(BaseModel):
    id: uuid.UUID
    server_id: uuid.UUID
    inviter_user_id: uuid.UUID
    inviter_username: str | None = None
    server_name: str
    code: str
    label: str | None
    notes: str | None
    max_uses: int | None
    use_count: int
    expires_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
    invite_url: str


class ServerInvitePreviewRead(BaseModel):
    code: str
    valid: bool
    server_id: uuid.UUID | None = None
    server_name: str | None = None
    inviter_username: str | None = None
    inviter_display_name: str | None = None
    label: str | None = None
    notes: str | None = None
    max_uses: int | None = None
    use_count: int = 0
    expires_at: datetime | None = None
    member_count: int = 0


class ServerInviteAcceptRead(BaseModel):
    ok: bool
    already_member: bool = False
    server_id: uuid.UUID
    server_name: str
