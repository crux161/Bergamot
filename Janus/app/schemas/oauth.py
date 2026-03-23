import uuid
from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class OAuthApplicationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=96)
    description: str | None = Field(default=None, max_length=2000)
    redirect_uri: HttpUrl
    scopes: list[str] = Field(default_factory=list)


class OAuthApplicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=96)
    description: str | None = Field(default=None, max_length=2000)
    redirect_uri: HttpUrl | None = None
    scopes: list[str] | None = None


class OAuthApplicationRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    redirect_uri: str
    client_id: str
    client_secret: str | None = None
    scopes: list[str]
    bot_user_id: uuid.UUID | None = None
    bot_username: str | None = None
    has_bot: bool = False
    created_at: datetime


class OAuthAuthorizedAppRead(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    application_name: str
    description: str | None
    redirect_uri: str
    scopes: list[str]
    created_at: datetime
    last_used_at: datetime | None


class OAuthAuthorizePreviewRead(BaseModel):
    application_id: uuid.UUID
    client_id: str
    application_name: str
    description: str | None
    redirect_uri: str
    requested_scopes: list[str]
    state: str | None = None
    already_authorized: bool


class OAuthAuthorizeDecision(BaseModel):
    client_id: str
    redirect_uri: HttpUrl
    scopes: list[str] = Field(default_factory=list)
    state: str | None = Field(default=None, max_length=256)
    approve: bool = True


class OAuthAuthorizationResult(BaseModel):
    redirect_uri: str
    code: str
    state: str | None


class OAuthTokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    scope: str
    expires_in: int


class OAuthClientSecretRead(BaseModel):
    client_secret: str


class OAuthBotProvisionRead(BaseModel):
    bot_user_id: uuid.UUID
    bot_username: str
    token: str
