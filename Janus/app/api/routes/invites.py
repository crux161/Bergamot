"""Server invite creation, preview, and redemption routes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.permissions import Permission, RequirePermission
from app.core.security import generate_secure_token
from app.models.server import Server
from app.models.server_invite import ServerInvite
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.invite import (
    ServerInviteAcceptRead,
    ServerInviteCreate,
    ServerInvitePreviewRead,
    ServerInviteRead,
)

router = APIRouter(tags=["invites"])


def _is_valid(invite: ServerInvite | None) -> bool:
    if invite is None:
        return False
    if invite.revoked_at is not None:
        return False
    if invite.expires_at is not None and invite.expires_at <= datetime.now(timezone.utc):
        return False
    if invite.max_uses is not None and invite.use_count >= invite.max_uses:
        return False
    return True


def _build_invite_url(code: str) -> str:
    return f"{settings.WEB_APP_URL.rstrip('/')}/#/invite?token={code}"


async def _load_invite(session: AsyncSession, code: str) -> tuple[ServerInvite | None, Server | None, User | None, int]:
    result = await session.execute(select(ServerInvite).where(ServerInvite.code == code))
    invite = result.scalar_one_or_none()
    if invite is None:
        return None, None, None, 0

    server_result = await session.execute(select(Server).where(Server.id == invite.server_id))
    server = server_result.scalar_one_or_none()
    inviter_result = await session.execute(select(User).where(User.id == invite.inviter_user_id))
    inviter = inviter_result.scalar_one_or_none()
    member_count = int((await session.scalar(
        select(func.count(ServerMember.id)).where(ServerMember.server_id == invite.server_id)
    )) or 0)
    return invite, server, inviter, member_count


def _to_read(invite: ServerInvite, *, server: Server, inviter: User | None) -> ServerInviteRead:
    return ServerInviteRead(
        id=invite.id,
        server_id=invite.server_id,
        inviter_user_id=invite.inviter_user_id,
        inviter_username=inviter.username if inviter is not None else None,
        server_name=server.name,
        code=invite.code,
        label=invite.label,
        notes=invite.notes,
        max_uses=invite.max_uses,
        use_count=invite.use_count,
        expires_at=invite.expires_at,
        revoked_at=invite.revoked_at,
        created_at=invite.created_at,
        invite_url=_build_invite_url(invite.code),
    )


def _to_preview(
    invite: ServerInvite | None,
    *,
    server: Server | None,
    inviter: User | None,
    member_count: int,
    code: str,
) -> ServerInvitePreviewRead:
    return ServerInvitePreviewRead(
        code=code,
        valid=_is_valid(invite) and server is not None,
        server_id=server.id if server is not None else None,
        server_name=server.name if server is not None else None,
        inviter_username=inviter.username if inviter is not None else None,
        inviter_display_name=inviter.display_name if inviter is not None else None,
        label=invite.label if invite is not None else None,
        notes=invite.notes if invite is not None else None,
        max_uses=invite.max_uses if invite is not None else None,
        use_count=invite.use_count if invite is not None else 0,
        expires_at=invite.expires_at if invite is not None else None,
        member_count=member_count,
    )


@router.get("/servers/{server_id}/invites", response_model=list[ServerInviteRead])
async def list_server_invites(
    server_id: str,
    ctx=Depends(RequirePermission(Permission.MANAGE_SERVER)),
    session: AsyncSession = Depends(get_session),
):
    del ctx
    result = await session.execute(
        select(ServerInvite).where(ServerInvite.server_id == server_id).order_by(ServerInvite.created_at.desc())
    )
    invites = result.scalars().all()
    server_result = await session.execute(select(Server).where(Server.id == server_id))
    server = server_result.scalar_one()
    inviter_ids = {invite.inviter_user_id for invite in invites}
    users_result = await session.execute(select(User).where(User.id.in_(inviter_ids)))
    inviter_map = {user.id: user for user in users_result.scalars().all()}
    return [_to_read(invite, server=server, inviter=inviter_map.get(invite.inviter_user_id)) for invite in invites]


@router.post("/servers/{server_id}/invites", response_model=ServerInviteRead, status_code=status.HTTP_201_CREATED)
async def create_server_invite(
    server_id: str,
    body: ServerInviteCreate,
    ctx=Depends(RequirePermission(Permission.MANAGE_SERVER)),
    session: AsyncSession = Depends(get_session),
):
    code = generate_secure_token()[:12]
    invite = ServerInvite(
        server_id=ctx.server.id,
        inviter_user_id=ctx.user.id,
        code=code,
        label=body.label,
        notes=body.notes,
        max_uses=body.max_uses,
        expires_at=(
            datetime.now(timezone.utc) + timedelta(hours=body.expires_in_hours)
            if body.expires_in_hours is not None
            else None
        ),
    )
    session.add(invite)
    await session.commit()
    await session.refresh(invite)
    return _to_read(invite, server=ctx.server, inviter=ctx.user)


@router.delete("/servers/{server_id}/invites/{invite_id}")
async def revoke_server_invite(
    server_id: str,
    invite_id: str,
    ctx=Depends(RequirePermission(Permission.MANAGE_SERVER)),
    session: AsyncSession = Depends(get_session),
):
    del ctx
    result = await session.execute(
        select(ServerInvite).where(ServerInvite.id == invite_id, ServerInvite.server_id == server_id)
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite.revoked_at = datetime.now(timezone.utc)
    await session.commit()
    return {"ok": True}


@router.get("/invites/{code}", response_model=ServerInvitePreviewRead)
async def preview_server_invite(
    code: str,
    session: AsyncSession = Depends(get_session),
):
    invite, server, inviter, member_count = await _load_invite(session, code)
    return _to_preview(invite, server=server, inviter=inviter, member_count=member_count, code=code)


@router.post("/invites/{code}/accept", response_model=ServerInviteAcceptRead)
async def accept_server_invite(
    code: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    invite, server, inviter, member_count = await _load_invite(session, code)
    del inviter, member_count
    if not _is_valid(invite) or server is None:
        raise HTTPException(status_code=400, detail="Invite is invalid or expired")

    member_result = await session.execute(
        select(ServerMember).where(
            ServerMember.server_id == server.id,
            ServerMember.user_id == current_user.id,
        )
    )
    membership = member_result.scalar_one_or_none()
    already_member = membership is not None
    if not already_member:
        session.add(ServerMember(server_id=server.id, user_id=current_user.id))
        invite.use_count += 1
        invite.last_used_at = datetime.now(timezone.utc)
        await session.commit()

    return ServerInviteAcceptRead(
        ok=True,
        already_member=already_member,
        server_id=server.id,
        server_name=server.name,
    )
