import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ExternalConnectionCreate(BaseModel):
    provider_account_id: str = Field(min_length=1, max_length=128)
    username: str | None = Field(default=None, max_length=128)
    display_name: str | None = Field(default=None, max_length=160)
    profile_url: str | None = Field(default=None, max_length=512)


class ExternalConnectionProviderRead(BaseModel):
    id: str
    label: str
    description: str
    default_scopes: list[str] = Field(default_factory=list)
    profile_url_template: str | None = None
    supports_login: bool = True
    supports_linking: bool = True


class ExternalConnectionLinkStartRequest(BaseModel):
    account_hint: str | None = Field(default=None, max_length=128)
    display_name: str | None = Field(default=None, max_length=160)


class ExternalConnectionLinkStartRead(BaseModel):
    challenge_id: str
    provider: str
    provider_label: str
    provider_account_id: str
    username: str | None
    display_name: str | None
    profile_url: str | None
    description: str
    default_scopes: list[str] = Field(default_factory=list)
    expires_at: datetime


class ExternalConnectionLinkComplete(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=128)
    provider_account_id: str | None = Field(default=None, max_length=128)
    username: str | None = Field(default=None, max_length=128)
    display_name: str | None = Field(default=None, max_length=160)
    profile_url: str | None = Field(default=None, max_length=512)


class ExternalConnectionRead(BaseModel):
    id: uuid.UUID
    provider: str
    provider_label: str | None = None
    provider_account_id: str
    username: str | None
    display_name: str | None
    profile_url: str | None
    connection_metadata: dict | None = None
    linked_at: datetime
    last_used_at: datetime | None
