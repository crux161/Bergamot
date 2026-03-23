from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class PendingAccountStatusRead(BaseModel):
    email: EmailStr | None
    email_verified: bool
    verification_required: bool


class AuthorizeIPRequest(BaseModel):
    token: str


class AuthorizeIPRead(BaseModel):
    ok: bool
    ip_address: str | None = None


class SsoCallbackRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=32)
    code: str = Field(min_length=1, max_length=128)
    state: str | None = Field(default=None, max_length=256)


class AuthEntryPreviewRead(BaseModel):
    flow: str
    valid: bool
    title: str
    description: str
    token: str | None = None
    theme: str | None = None
    expires_at: datetime | None = None
    payload: dict | None = None
