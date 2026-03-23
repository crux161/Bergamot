"""Schemas for moderation reports and admin moderation views."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    reason: str = Field(min_length=10, max_length=500)
    message_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    server_id: uuid.UUID | None = None


class ReportUpdate(BaseModel):
    status: str = Field(pattern=r"^(open|investigating|resolved|dismissed)$")
    resolution_notes: str | None = Field(default=None, max_length=1000)


class ReportRead(BaseModel):
    id: uuid.UUID
    reporter_user_id: uuid.UUID
    reporter_username: str | None = None
    target_type: str
    target_user_id: uuid.UUID | None = None
    target_message_id: uuid.UUID | None = None
    target_server_id: uuid.UUID | None = None
    target_username: str | None = None
    server_name: str | None = None
    message_excerpt: str | None = None
    reason: str
    status: str
    resolution_notes: str | None = None
    reviewed_by_user_id: uuid.UUID | None = None
    reviewed_by_username: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class AdminOverviewRead(BaseModel):
    total_users: int
    total_servers: int
    total_messages: int
    open_reports: int
    investigating_reports: int
    suspended_users: int


class AdminUserRead(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    display_name: str | None = None
    created_at: datetime
    suspended_at: datetime | None = None
    suspension_reason: str | None = None


class AdminServerRead(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    owner_username: str | None = None
    created_at: datetime
    member_count: int = 0


class SuspendUserPayload(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class AuditLogEntry(BaseModel):
    id: str
    action: str
    actor_id: uuid.UUID | None = None
    actor_username: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    target_label: str | None = None
    detail: str | None = None
    created_at: datetime


class AdminChannelRead(BaseModel):
    id: uuid.UUID
    name: str
    channel_type: str
    server_id: uuid.UUID
    server_name: str | None = None
    message_count: int = 0
    created_at: datetime


class AdminMediaStatsRead(BaseModel):
    total_attachments: int
    total_avatars: int
    total_server_icons: int


class AdminInstanceConfigUpdate(BaseModel):
    registration_enabled: bool | None = None
    max_servers_per_user: int | None = Field(default=None, ge=1, le=1000)
    max_channels_per_server: int | None = Field(default=None, ge=1, le=5000)
    max_message_length: int | None = Field(default=None, ge=1, le=20000)
