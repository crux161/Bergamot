"""Server audit log endpoints."""

import uuid
from enum import IntEnum

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.permissions import Permission, PermissionContext, RequirePermission
from app.models.audit_log import AuditLogEntry

router = APIRouter(prefix="/servers/{server_id}/audit-log", tags=["audit-log"])


# ── Action types ──

class AuditAction(IntEnum):
    MEMBER_BAN = 1
    MEMBER_UNBAN = 2
    MEMBER_KICK = 3
    ROLE_CREATE = 4
    ROLE_UPDATE = 5
    ROLE_DELETE = 6
    CHANNEL_CREATE = 7
    CHANNEL_UPDATE = 8
    CHANNEL_DELETE = 9
    SERVER_UPDATE = 10
    INVITE_CREATE = 11
    INVITE_REVOKE = 12
    MESSAGE_PIN = 13
    MESSAGE_DELETE = 14


ACTION_LABELS: dict[int, str] = {v.value: v.name.replace("_", " ").title() for v in AuditAction}


# ── Schemas ──

class AuditLogEntryRead(BaseModel):
    id: uuid.UUID
    action_type: int
    action_label: str
    user_id: uuid.UUID | None = None
    user_name: str | None = None
    target_id: str | None = None
    reason: str | None = None
    extra: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


# ── Endpoints ──

@router.get("", response_model=list[AuditLogEntryRead])
async def list_audit_log(
    action_type: int | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_SERVER)),
    session: AsyncSession = Depends(get_session),
):
    """List audit log entries for a server."""
    stmt = select(AuditLogEntry).where(AuditLogEntry.server_id == ctx.server.id)
    if action_type is not None:
        stmt = stmt.where(AuditLogEntry.action_type == action_type)
    stmt = stmt.order_by(AuditLogEntry.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    entries = result.scalars().all()
    return [
        AuditLogEntryRead(
            id=entry.id,
            action_type=entry.action_type,
            action_label=ACTION_LABELS.get(entry.action_type, f"Action {entry.action_type}"),
            user_id=entry.user_id,
            user_name=(entry.user.display_name or entry.user.username) if entry.user else None,
            target_id=entry.target_id,
            reason=entry.reason,
            extra=entry.extra,
            created_at=entry.created_at.isoformat(),
        )
        for entry in entries
    ]


async def write_audit_log(
    session: AsyncSession,
    *,
    server_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action_type: int,
    target_id: str | None = None,
    reason: str | None = None,
    extra: str | None = None,
) -> AuditLogEntry:
    """Helper to insert an audit log entry from other routes."""
    entry = AuditLogEntry(
        server_id=server_id,
        user_id=user_id,
        action_type=action_type,
        target_id=target_id,
        reason=reason,
        extra=extra,
    )
    session.add(entry)
    return entry
