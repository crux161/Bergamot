"""Global admin and moderation routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_auth import get_admin_user
from app.core.database import get_session
from app.core.realtime_bridge import emit_message_domain_event
from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.message import Message
from app.models.moderation_report import ModerationReport
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.report import (
    AdminChannelRead,
    AdminInstanceConfigUpdate,
    AdminMediaStatsRead,
    AdminOverviewRead,
    AdminServerRead,
    AdminUserRead,
    AuditLogEntry,
    ReportRead,
    ReportUpdate,
    SuspendUserPayload,
)
from app.api.routes.reports import _serialize_report

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewRead)
async def get_admin_overview(
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Return instance-wide moderation and operations counts."""
    del admin_user
    open_reports = int((await session.scalar(
        select(func.count(ModerationReport.id)).where(ModerationReport.status == "open")
    )) or 0)
    investigating_reports = int((await session.scalar(
        select(func.count(ModerationReport.id)).where(ModerationReport.status == "investigating")
    )) or 0)
    suspended_users = int((await session.scalar(
        select(func.count(User.id)).where(User.suspended_at.is_not(None))
    )) or 0)
    total_users = int((await session.scalar(select(func.count(User.id)))) or 0)
    total_servers = int((await session.scalar(select(func.count(Server.id)))) or 0)
    total_messages = int((await session.scalar(select(func.count(Message.id)))) or 0)
    return AdminOverviewRead(
        total_users=total_users,
        total_servers=total_servers,
        total_messages=total_messages,
        open_reports=open_reports,
        investigating_reports=investigating_reports,
        suspended_users=suspended_users,
    )


@router.get("/reports", response_model=list[ReportRead])
async def list_reports(
    status_filter: str | None = Query(default=None, alias="status"),
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """List moderation reports, optionally filtered by status."""
    del admin_user
    statement = select(ModerationReport).order_by(
        ModerationReport.created_at.desc()
    )
    if status_filter and status_filter != "all":
        statement = statement.where(ModerationReport.status == status_filter)
    result = await session.execute(statement)
    return [_serialize_report(report) for report in result.scalars().all()]


@router.patch("/reports/{report_id}", response_model=ReportRead)
async def update_report(
    report_id: uuid.UUID,
    body: ReportUpdate,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Update a moderation report's review status."""
    result = await session.execute(select(ModerationReport).where(ModerationReport.id == report_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    report.status = body.status
    report.resolution_notes = body.resolution_notes
    report.reviewed_by_user_id = admin_user.id
    report.reviewed_at = datetime.now(timezone.utc)
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return _serialize_report(report)


@router.get("/users", response_model=list[AdminUserRead])
async def list_users(
    query: str | None = Query(default=None, min_length=1, max_length=64),
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """List users for moderation and support workflows."""
    del admin_user
    statement = select(User).order_by(User.created_at.desc()).limit(100)
    if query:
        needle = f"%{query.lower()}%"
        statement = (
            select(User)
            .where(
                or_(
                    func.lower(User.username).like(needle),
                    func.lower(User.email).like(needle),
                    func.lower(func.coalesce(User.display_name, "")).like(needle),
                )
            )
            .order_by(User.created_at.desc())
            .limit(100)
        )
    result = await session.execute(statement)
    return [
        AdminUserRead(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
            suspended_at=user.suspended_at,
            suspension_reason=user.suspension_reason,
        )
        for user in result.scalars().all()
    ]


@router.post("/users/{user_id}/suspend", response_model=AdminUserRead)
async def suspend_user(
    user_id: uuid.UUID,
    body: SuspendUserPayload,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Suspend a user account from authenticating."""
    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot suspend your own account")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.suspended_at = datetime.now(timezone.utc)
    user.suspension_reason = body.reason or "Account suspended by Bergamot Admin"
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AdminUserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        suspended_at=user.suspended_at,
        suspension_reason=user.suspension_reason,
    )


@router.post("/users/{user_id}/unsuspend", response_model=AdminUserRead)
async def unsuspend_user(
    user_id: uuid.UUID,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Lift an account suspension."""
    del admin_user
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.suspended_at = None
    user.suspension_reason = None
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AdminUserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        suspended_at=user.suspended_at,
        suspension_reason=user.suspension_reason,
    )


@router.get("/servers", response_model=list[AdminServerRead])
async def list_servers(
    query: str | None = Query(default=None, min_length=1, max_length=100),
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """List servers for moderation and support workflows."""
    del admin_user
    statement = select(Server).order_by(Server.created_at.desc()).limit(100)
    if query:
        statement = (
            select(Server)
            .where(func.lower(Server.name).like(f"%{query.lower()}%"))
            .order_by(Server.created_at.desc())
            .limit(100)
        )
    result = await session.execute(statement)
    servers = list(result.scalars().all())
    items: list[AdminServerRead] = []
    for server in servers:
        owner_result = await session.execute(select(User).where(User.id == server.owner_id))
        owner = owner_result.scalar_one_or_none()
        member_count = int((await session.scalar(
            select(func.count(ServerMember.id)).where(ServerMember.server_id == server.id)
        )) or 0)
        items.append(
            AdminServerRead(
                id=server.id,
                name=server.name,
                owner_id=server.owner_id,
                owner_username=owner.username if owner is not None else None,
                created_at=server.created_at,
                member_count=member_count,
            )
        )
    return items


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_as_admin(
    message_id: uuid.UUID,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete any message as a global admin moderation action."""
    result = await session.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    sender_result = await session.execute(select(User).where(User.id == message.sender_id))
    sender = sender_result.scalar_one_or_none()
    deleted_at = datetime.now(timezone.utc)

    channel_result = await session.execute(select(Channel).where(Channel.id == message.channel_id))
    channel = channel_result.scalar_one_or_none()
    conversation = None
    stream_kind = "channel"
    if channel is None:
        conv_result = await session.execute(select(DMConversation).where(DMConversation.id == message.channel_id))
        conversation = conv_result.scalar_one_or_none()
        stream_kind = "dm"

    await session.delete(message)
    await session.commit()

    if sender is not None:
        await emit_message_domain_event(
            session,
            event_type="message_deleted",
            message=message,
            sender=sender,
            actor=admin_user,
            stream_kind=stream_kind,
            stream_id=message.channel_id,
            channel=channel,
            conversation=conversation,
            deleted_at=deleted_at,
        )


@router.get("/audit-log", response_model=list[AuditLogEntry])
async def get_audit_log(
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Return a synthetic audit log built from moderation report reviews and user suspensions."""
    del admin_user
    entries: list[AuditLogEntry] = []

    reviewed = await session.execute(
        select(ModerationReport)
        .where(ModerationReport.reviewed_at.is_not(None))
        .order_by(ModerationReport.reviewed_at.desc())
        .limit(100)
    )
    for report in reviewed.scalars().all():
        reviewer = None
        if report.reviewed_by_user_id:
            result = await session.execute(select(User).where(User.id == report.reviewed_by_user_id))
            reviewer = result.scalar_one_or_none()
        entries.append(AuditLogEntry(
            id=f"report-{report.id}",
            action=f"report_{report.status}",
            actor_id=report.reviewed_by_user_id,
            actor_username=reviewer.username if reviewer else None,
            target_type="report",
            target_id=str(report.id),
            target_label=report.reason[:80] if report.reason else None,
            detail=report.resolution_notes,
            created_at=report.reviewed_at,
        ))

    suspended = await session.execute(
        select(User)
        .where(User.suspended_at.is_not(None))
        .order_by(User.suspended_at.desc())
        .limit(50)
    )
    for user in suspended.scalars().all():
        entries.append(AuditLogEntry(
            id=f"suspend-{user.id}",
            action="user_suspended",
            actor_id=None,
            actor_username=None,
            target_type="user",
            target_id=str(user.id),
            target_label=user.username,
            detail=user.suspension_reason,
            created_at=user.suspended_at,
        ))

    entries.sort(key=lambda e: e.created_at, reverse=True)
    return entries[:100]


@router.get("/channels", response_model=list[AdminChannelRead])
async def list_channels(
    query: str | None = Query(default=None, min_length=1, max_length=100),
    server_id: uuid.UUID | None = Query(default=None),
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """List channels with message counts for admin review."""
    del admin_user
    statement = select(Channel).order_by(Channel.created_at.desc()).limit(100)
    if server_id:
        statement = statement.where(Channel.server_id == server_id)
    if query:
        statement = statement.where(func.lower(Channel.name).like(f"%{query.lower()}%"))
    result = await session.execute(statement)
    channels = list(result.scalars().all())
    items: list[AdminChannelRead] = []
    for channel in channels:
        message_count = int((await session.scalar(
            select(func.count(Message.id)).where(Message.channel_id == channel.id)
        )) or 0)
        server_result = await session.execute(select(Server).where(Server.id == channel.server_id))
        server = server_result.scalar_one_or_none()
        items.append(AdminChannelRead(
            id=channel.id,
            name=channel.name,
            channel_type=channel.channel_type,
            server_id=channel.server_id,
            server_name=server.name if server else None,
            message_count=message_count,
            created_at=channel.created_at,
        ))
    return items


@router.get("/media-stats", response_model=AdminMediaStatsRead)
async def get_media_stats(
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Return aggregate media/attachment statistics."""
    del admin_user
    total_attachments = int((await session.scalar(
        select(func.count(Message.id)).where(Message.attachments.is_not(None))
    )) or 0)
    total_avatars = int((await session.scalar(
        select(func.count(User.id)).where(User.avatar_url.is_not(None))
    )) or 0)
    total_server_icons = int((await session.scalar(
        select(func.count(Server.id)).where(Server.icon_url.is_not(None))
    )) or 0)
    return AdminMediaStatsRead(
        total_attachments=total_attachments,
        total_avatars=total_avatars,
        total_server_icons=total_server_icons,
    )


_instance_config = {
    "registration_enabled": True,
    "max_servers_per_user": 100,
    "max_channels_per_server": 500,
    "max_message_length": 4000,
}


@router.get("/config")
async def get_instance_config(
    admin_user: User = Depends(get_admin_user),
):
    """Return the current instance configuration limits."""
    del admin_user
    return _instance_config


@router.patch("/config")
async def update_instance_config(
    body: AdminInstanceConfigUpdate,
    admin_user: User = Depends(get_admin_user),
):
    """Update instance configuration limits at runtime."""
    del admin_user
    updates = body.model_dump(exclude_unset=True)
    _instance_config.update(updates)
    return _instance_config
