"""Read-state routes for channels and DM conversations."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.realtime_bridge import emit_read_state_domain_event, emit_unread_count_updated
from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.message import Message
from app.models.read_state import ReadState, ReadStateTarget
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.read_state import ReadStateRead, ReadStateUpdate

router = APIRouter(prefix="/read-states", tags=["read-states"])


async def _ensure_target_access(
    session: AsyncSession,
    current_user: User,
    target_kind: ReadStateTarget,
    target_id: uuid.UUID,
) -> None:
    if target_kind == ReadStateTarget.DM:
        result = await session.execute(
            select(DMConversation).where(DMConversation.id == target_id)
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        if current_user.id not in (conversation.user_a_id, conversation.user_b_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this conversation")
        return

    result = await session.execute(select(Channel).where(Channel.id == target_id))
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    member_result = await session.execute(
        select(ServerMember).where(
            ServerMember.server_id == channel.server_id,
            ServerMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if member is not None:
        return

    owner_result = await session.execute(
        select(Server.owner_id).where(Server.id == channel.server_id)
    )
    owner_id = owner_result.scalar_one_or_none()
    if owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this channel")


async def _count_unread_messages(
    session: AsyncSession,
    *,
    current_user_id: uuid.UUID,
    target_id: uuid.UUID,
    last_read_at: datetime | None,
) -> int:
    statement = select(func.count(Message.id)).where(
        Message.channel_id == target_id,
        Message.sender_id != current_user_id,
    )
    if last_read_at is not None:
        statement = statement.where(Message.created_at > last_read_at)
    count = await session.scalar(statement)
    return int(count or 0)


def _serialize_read_state(state: ReadState, unread_count: int) -> ReadStateRead:
    return ReadStateRead(
        id=state.id,
        user_id=state.user_id,
        target_kind=state.target_kind,
        target_id=state.target_id,
        last_read_message_id=state.last_read_message_id,
        last_read_at=state.last_read_at,
        unread_count=unread_count,
        updated_at=state.updated_at,
    )


@router.get("/", response_model=list[ReadStateRead])
async def list_read_states(
    target_kind: ReadStateTarget | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List stored read states for the current user."""
    statement = select(ReadState).where(ReadState.user_id == current_user.id)
    if target_kind is not None:
        statement = statement.where(ReadState.target_kind == target_kind)

    result = await session.execute(statement.order_by(ReadState.updated_at.desc()))
    states = list(result.scalars().all())

    payload: list[ReadStateRead] = []
    for state in states:
        unread_count = await _count_unread_messages(
            session,
            current_user_id=current_user.id,
            target_id=state.target_id,
            last_read_at=state.last_read_at,
        )
        payload.append(_serialize_read_state(state, unread_count))
    return payload


@router.put("/{target_kind}/{target_id}", response_model=ReadStateRead)
async def mark_read_state(
    target_kind: ReadStateTarget,
    target_id: uuid.UUID,
    body: ReadStateUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Mark a channel or DM conversation as read for the current user."""
    await _ensure_target_access(session, current_user, target_kind, target_id)

    latest_message: Message | None
    if body.last_read_message_id is not None:
        message_result = await session.execute(
            select(Message).where(
                Message.id == body.last_read_message_id,
                Message.channel_id == target_id,
            )
        )
        latest_message = message_result.scalar_one_or_none()
        if latest_message is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Read marker message not found in this stream",
            )
    else:
        latest_result = await session.execute(
            select(Message)
            .where(Message.channel_id == target_id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        latest_message = latest_result.scalar_one_or_none()

    state_result = await session.execute(
        select(ReadState).where(
            ReadState.user_id == current_user.id,
            ReadState.target_kind == target_kind,
            ReadState.target_id == target_id,
        )
    )
    state = state_result.scalar_one_or_none()
    if state is None:
        state = ReadState(
            user_id=current_user.id,
            target_kind=target_kind,
            target_id=target_id,
        )
        session.add(state)

    state.last_read_message_id = latest_message.id if latest_message is not None else None
    state.last_read_at = latest_message.created_at if latest_message is not None else datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(state)
    await emit_read_state_domain_event(
        user_id=current_user.id,
        target_kind=target_kind.value,
        target_id=target_id,
        last_read_message_id=state.last_read_message_id,
        last_read_at=state.last_read_at,
        updated_at=state.updated_at,
    )
    if target_kind == ReadStateTarget.DM:
        await emit_unread_count_updated(
            session,
            user_id=current_user.id,
            reason="read_state_updated",
            target_kind=target_kind.value,
            target_id=target_id,
        )

    return _serialize_read_state(state, unread_count=0)
