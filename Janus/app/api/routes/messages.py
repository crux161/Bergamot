"""Message routes: create, list, edit, delete, and pin messages within a channel."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.message_activity import sync_channel_message_activity
from app.core.realtime_bridge import emit_message_activity_events, emit_message_domain_event
from app.core.message_views import build_message_read
from app.core.permissions import (
    DEFAULT_EVERYONE_PERMISSIONS,
    Permission,
    compute_permissions,
)
from app.models.channel import Channel
from app.models.member_role import MemberRole
from app.models.message import Message
from app.models.message_reaction import MessageReaction
from app.models.role import Role
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.message import MessageCreate, MessageRead, MessageUpdate

router = APIRouter(prefix="/channels/{channel_id}/messages", tags=["messages"])


@router.post("/", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    channel_id: str,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Persist a new message in the given channel."""
    # Verify channel exists
    result = await session.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    # Validate reply_to_id if provided
    if body.reply_to_id is not None:
        ref_result = await session.execute(
            select(Message).where(
                Message.id == body.reply_to_id,
                Message.channel_id == channel_id,
            )
        )
        if ref_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Replied-to message not found in this channel",
            )

    message = Message(
        channel_id=channel.id,
        sender_id=current_user.id,
        content=body.content,
        nonce=body.nonce,
        attachments=body.attachments,
        reply_to_id=body.reply_to_id,
    )
    session.add(message)
    await session.commit()

    # Reload with reply_to relationship
    result = await session.execute(
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(Message.id == message.id)
    )
    message = result.scalar_one()
    sync_result = await sync_channel_message_activity(session, message=message, actor=current_user, channel=channel)
    await session.commit()
    await emit_message_domain_event(
        session,
        event_type="message_created",
        message=message,
        sender=current_user,
        actor=current_user,
        stream_kind="channel",
        stream_id=channel.id,
        channel=channel,
    )
    await emit_message_activity_events(session, sync_result=sync_result, reason="message_created")

    return await build_message_read(message, current_user.id, session)


@router.patch("/{message_id}", response_model=MessageRead)
async def edit_message(
    channel_id: str,
    message_id: str,
    body: MessageUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Edit a message's content. Only the sender can edit."""
    result = await session.execute(
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(Message.id == message_id, Message.channel_id == channel_id)
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.sender_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only edit your own messages")

    message.content = body.content
    message.edited_at = datetime.now(timezone.utc)
    channel_result = await session.execute(select(Channel).where(Channel.id == channel_id))
    channel = channel_result.scalar_one()
    sync_result = await sync_channel_message_activity(session, message=message, actor=current_user, channel=channel)
    await session.commit()
    await session.refresh(message)
    await emit_message_domain_event(
        session,
        event_type="message_edited",
        message=message,
        sender=current_user,
        actor=current_user,
        stream_kind="channel",
        stream_id=channel.id,
        channel=channel,
    )
    await emit_message_activity_events(session, sync_result=sync_result, reason="message_edited")

    return await build_message_read(message, current_user.id, session)


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    channel_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a message. Sender can always delete own. MANAGE_MESSAGES for others."""
    result = await session.execute(
        select(Message).where(Message.id == message_id, Message.channel_id == channel_id)
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.sender_id != current_user.id:
        channel_result = await session.execute(
            select(Channel).where(Channel.id == channel_id)
        )
        channel = channel_result.scalar_one_or_none()
        if channel is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Channel not found")

        server_result = await session.execute(
            select(Server).where(Server.id == channel.server_id)
        )
        server = server_result.scalar_one_or_none()

        member_result = await session.execute(
            select(ServerMember).where(
                ServerMember.server_id == server.id,
                ServerMember.user_id == current_user.id,
            )
        )
        member = member_result.scalar_one_or_none()
        if member is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not a member of this server")

        everyone_result = await session.execute(
            select(Role).where(Role.server_id == server.id, Role.is_default == True)  # noqa: E712
        )
        everyone_role = everyone_result.scalar_one_or_none()
        everyone_perms = everyone_role.permissions if everyone_role else DEFAULT_EVERYONE_PERMISSIONS

        role_result = await session.execute(
            select(Role.permissions)
            .join(MemberRole, MemberRole.role_id == Role.id)
            .where(MemberRole.member_id == member.id)
        )
        member_role_perms = [row[0] for row in role_result.all()]

        effective = compute_permissions(
            server_owner_id=server.owner_id,
            user_id=current_user.id,
            everyone_permissions=everyone_perms,
            member_role_permissions=member_role_perms,
        )

        if not (effective & Permission.MANAGE_MESSAGES):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this message",
            )

    if message.sender_id == current_user.id:
        channel_result = await session.execute(select(Channel).where(Channel.id == channel_id))
        channel = channel_result.scalar_one_or_none()
    sender_result = await session.execute(select(User).where(User.id == message.sender_id))
    sender = sender_result.scalar_one_or_none()
    deleted_at = datetime.now(timezone.utc)

    await session.delete(message)
    await session.commit()
    if channel is not None and sender is not None:
        await emit_message_domain_event(
            session,
            event_type="message_deleted",
            message=message,
            sender=sender,
            actor=current_user,
            stream_kind="channel",
            stream_id=channel.id,
            channel=channel,
            deleted_at=deleted_at,
        )


@router.get("/", response_model=list[MessageRead])
async def list_messages(
    channel_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List recent messages in a channel, ordered oldest-first."""
    result = await session.execute(
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(result.scalars().unique().all())
    messages.reverse()

    out = []
    for msg in messages:
        out.append(await build_message_read(msg, current_user.id, session))
    return out


# ── Pin endpoints ──

@router.put("/{message_id}/pin", status_code=status.HTTP_204_NO_CONTENT)
async def pin_message(
    channel_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Pin a message in the channel."""
    result = await session.execute(
        select(Message).where(Message.id == message_id, Message.channel_id == channel_id)
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Message not found")

    message.pinned = True
    message.pinned_at = datetime.now(timezone.utc)
    message.pinned_by = current_user.id
    await session.commit()


@router.delete("/{message_id}/pin", status_code=status.HTTP_204_NO_CONTENT)
async def unpin_message(
    channel_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Unpin a message."""
    result = await session.execute(
        select(Message).where(Message.id == message_id, Message.channel_id == channel_id)
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Message not found")

    message.pinned = False
    message.pinned_at = None
    message.pinned_by = None
    await session.commit()


@router.get("/pins", response_model=list[MessageRead])
async def list_pinned_messages(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all pinned messages in a channel."""
    result = await session.execute(
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(Message.channel_id == channel_id, Message.pinned == True)  # noqa: E712
        .order_by(Message.pinned_at.desc())
    )
    messages = list(result.scalars().unique().all())

    out = []
    for msg in messages:
        out.append(await build_message_read(msg, current_user.id, session))
    return out
