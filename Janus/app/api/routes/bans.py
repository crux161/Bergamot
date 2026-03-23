"""Server ban management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.audit_log import AuditAction, write_audit_log
from app.core.database import get_session
from app.core.permissions import Permission, PermissionContext, RequirePermission
from app.models.server_ban import ServerBan
from app.models.server_member import ServerMember

router = APIRouter(prefix="/servers/{server_id}/bans", tags=["bans"])


# ── Schemas ──


class BanCreate(BaseModel):
    user_id: uuid.UUID
    reason: str | None = Field(None, max_length=512)


class BanRead(BaseModel):
    id: uuid.UUID
    server_id: uuid.UUID
    user_id: uuid.UUID
    banned_by_id: uuid.UUID | None = None
    reason: str | None = None
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    banned_by_name: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


# ── Endpoints ──


@router.get("", response_model=list[BanRead])
async def list_bans(
    ctx: PermissionContext = Depends(RequirePermission(Permission.KICK_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    """List all bans for a server."""
    result = await session.execute(
        select(ServerBan).where(ServerBan.server_id == ctx.server.id).order_by(ServerBan.created_at.desc())
    )
    bans = result.scalars().all()
    return [
        BanRead(
            id=ban.id,
            server_id=ban.server_id,
            user_id=ban.user_id,
            banned_by_id=ban.banned_by_id,
            reason=ban.reason,
            username=ban.user.username if ban.user else None,
            display_name=ban.user.display_name if ban.user else None,
            avatar_url=ban.user.avatar_url if ban.user else None,
            banned_by_name=(ban.banned_by.display_name or ban.banned_by.username) if ban.banned_by else None,
            created_at=ban.created_at.isoformat(),
        )
        for ban in bans
    ]


@router.post("", response_model=BanRead, status_code=status.HTTP_201_CREATED)
async def ban_member(
    body: BanCreate,
    ctx: PermissionContext = Depends(RequirePermission(Permission.KICK_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    """Ban a user from the server, removing their membership."""
    if body.user_id == ctx.user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You cannot ban yourself")
    if body.user_id == ctx.server.owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot ban the server owner")

    # Check if already banned
    existing = await session.execute(
        select(ServerBan).where(ServerBan.server_id == ctx.server.id, ServerBan.user_id == body.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="User is already banned")

    # Remove membership if present
    await session.execute(
        delete(ServerMember).where(
            ServerMember.server_id == ctx.server.id, ServerMember.user_id == body.user_id
        )
    )

    ban = ServerBan(
        server_id=ctx.server.id,
        user_id=body.user_id,
        banned_by_id=ctx.user.id,
        reason=body.reason,
    )
    session.add(ban)
    await write_audit_log(
        session,
        server_id=ctx.server.id,
        user_id=ctx.user.id,
        action_type=AuditAction.MEMBER_BAN,
        target_id=str(body.user_id),
        reason=body.reason,
    )
    await session.commit()
    await session.refresh(ban)

    return BanRead(
        id=ban.id,
        server_id=ban.server_id,
        user_id=ban.user_id,
        banned_by_id=ban.banned_by_id,
        reason=ban.reason,
        username=ban.user.username if ban.user else None,
        display_name=ban.user.display_name if ban.user else None,
        avatar_url=ban.user.avatar_url if ban.user else None,
        banned_by_name=(ban.banned_by.display_name or ban.banned_by.username) if ban.banned_by else None,
        created_at=ban.created_at.isoformat(),
    )


@router.delete("/{ban_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unban_member(
    ban_id: uuid.UUID,
    ctx: PermissionContext = Depends(RequirePermission(Permission.KICK_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    """Remove a ban, allowing the user to rejoin."""
    result = await session.execute(
        select(ServerBan).where(ServerBan.id == ban_id, ServerBan.server_id == ctx.server.id)
    )
    ban = result.scalar_one_or_none()
    if ban is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ban not found")
    await write_audit_log(
        session,
        server_id=ctx.server.id,
        user_id=ctx.user.id,
        action_type=AuditAction.MEMBER_UNBAN,
        target_id=str(ban.user_id),
    )
    await session.delete(ban)
    await session.commit()
