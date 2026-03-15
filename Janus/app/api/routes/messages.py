"""Message routes: create and list messages within a channel."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.permissions import (
    DEFAULT_EVERYONE_PERMISSIONS,
    Permission,
    compute_permissions,
)
from app.models.channel import Channel
from app.models.member_role import MemberRole
from app.models.message import Message
from app.models.role import Role
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.message import MessageCreate, MessageRead

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

    message = Message(
        channel_id=channel.id,
        sender_id=current_user.id,
        content=body.content,
        nonce=body.nonce,
        attachments=body.attachments,
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return message


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    channel_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a message.

    The sender can always delete their own messages. Users with the
    MANAGE_MESSAGES permission on the server can delete any message.
    """
    result = await session.execute(
        select(Message).where(Message.id == message_id, Message.channel_id == channel_id)
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Sender can always delete own messages
    if message.sender_id != current_user.id:
        # Check if user has MANAGE_MESSAGES on this server
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

        # Compute permissions
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

    await session.delete(message)
    await session.commit()


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
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.reverse()  # Return oldest-first for display
    return messages
