"""User-facing moderation report routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.channel import Channel
from app.models.message import Message
from app.models.moderation_report import ModerationReport
from app.models.server import Server
from app.models.user import User
from app.schemas.report import ReportCreate, ReportRead

router = APIRouter(prefix="/reports", tags=["reports"])


def _serialize_report(report: ModerationReport) -> ReportRead:
    reporter = report.__dict__.get("reporter")
    target_user = report.__dict__.get("target_user")
    target_server = report.__dict__.get("target_server")
    reviewed_by = report.__dict__.get("reviewed_by")
    return ReportRead(
        id=report.id,
        reporter_user_id=report.reporter_user_id,
        reporter_username=reporter.username if reporter is not None else None,
        target_type=report.target_type,
        target_user_id=report.target_user_id,
        target_message_id=report.target_message_id,
        target_server_id=report.target_server_id,
        target_username=(
            target_user.username
            if target_user is not None
            else report.target_username_snapshot
        ),
        server_name=(
            target_server.name
            if target_server is not None
            else report.server_name_snapshot
        ),
        message_excerpt=report.message_excerpt,
        reason=report.reason,
        status=report.status,
        resolution_notes=report.resolution_notes,
        reviewed_by_user_id=report.reviewed_by_user_id,
        reviewed_by_username=reviewed_by.username if reviewed_by is not None else None,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
    )


@router.post("/", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a moderation report against one message, user, or server."""
    target_count = sum(
        1
        for value in (body.message_id, body.user_id, body.server_id)
        if value is not None
    )
    if target_count != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exactly one report target must be provided",
        )

    report = ModerationReport(
        reporter_user_id=current_user.id,
        reason=body.reason.strip(),
    )

    if body.message_id is not None:
        message_result = await session.execute(select(Message).where(Message.id == body.message_id))
        message = message_result.scalar_one_or_none()
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        sender_result = await session.execute(select(User).where(User.id == message.sender_id))
        sender = sender_result.scalar_one_or_none()
        server_name = None
        channel_result = await session.execute(select(Channel).where(Channel.id == message.channel_id))
        channel = channel_result.scalar_one_or_none()
        if channel is not None:
            server_result = await session.execute(select(Server).where(Server.id == channel.server_id))
            server = server_result.scalar_one_or_none()
            server_name = server.name if server is not None else None
            if server is not None:
                report.target_server_id = server.id
        report.target_type = "message"
        report.target_message_id = message.id
        report.target_user_id = sender.id if sender is not None else None
        report.target_username_snapshot = sender.username if sender is not None else None
        report.server_name_snapshot = server_name
        report.message_excerpt = (message.content or "").strip()[:500]
    elif body.user_id is not None:
        target_result = await session.execute(select(User).where(User.id == body.user_id))
        target_user = target_result.scalar_one_or_none()
        if target_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        report.target_type = "user"
        report.target_user_id = target_user.id
        report.target_username_snapshot = target_user.username
    else:
        server_result = await session.execute(select(Server).where(Server.id == body.server_id))
        server = server_result.scalar_one_or_none()
        if server is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
        report.target_type = "server"
        report.target_server_id = server.id
        report.server_name_snapshot = server.name

    session.add(report)
    await session.commit()
    await session.refresh(report)
    return ReportRead(
        id=report.id,
        reporter_user_id=report.reporter_user_id,
        reporter_username=current_user.username,
        target_type=report.target_type,
        target_user_id=report.target_user_id,
        target_message_id=report.target_message_id,
        target_server_id=report.target_server_id,
        target_username=report.target_username_snapshot,
        server_name=report.server_name_snapshot,
        message_excerpt=report.message_excerpt,
        reason=report.reason,
        status=report.status,
        resolution_notes=report.resolution_notes,
        reviewed_by_user_id=report.reviewed_by_user_id,
        reviewed_by_username=None,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
    )


@router.get("/mine", response_model=list[ReportRead])
async def list_my_reports(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List the authenticated user's previously submitted reports."""
    result = await session.execute(
        select(ModerationReport)
        .where(ModerationReport.reporter_user_id == current_user.id)
        .order_by(ModerationReport.created_at.desc())
    )
    return [_serialize_report(report) for report in result.scalars().all()]
