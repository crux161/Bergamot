import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=64)


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=64)
    avatar_url: str | None = None
    banner_url: str | None = None
    status: str | None = Field(default=None, pattern=r"^(online|idle|dnd|offline)$")
    status_message: str | None = Field(default=None, max_length=128)


class UserRead(BaseModel):
    id: uuid.UUID
    username: str
    email: EmailStr
    display_name: str | None
    avatar_url: str | None
    banner_url: str | None
    status: str
    status_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
