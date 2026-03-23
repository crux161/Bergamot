"""DM (Direct Message) routes: create conversations, list conversations, and messages."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.message_activity import sync_dm_message_activity
from app.core.realtime_bridge import emit_message_activity_events, emit_message_domain_event
from app.core.message_views import build_message_read
from app.models.dm_conversation import DMConversation
from app.models.message import Message
from app.models.read_state import ReadState, ReadStateTarget
from app.models.user import User
from app.schemas.dm import DMConversationCreate, DMConversationRead
from app.schemas.message import MessageCreate, MessageRead

router = APIRouter(prefix="/dm", tags=["dm"])


def _ordered_pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """Return (smaller, larger) UUID to enforce canonical ordering."""
    return (a, b) if str(a) < str(b) else (b, a)


def _build_conversation_read(
    conv: DMConversation,
    peer: User,
    last_msg: str | None = None,
    last_msg_at=None,
    unread_count: int = 0,
) -> DMConversationRead:
    return DMConversationRead(
        id=conv.id,
        user_a_id=conv.user_a_id,
        user_b_id=conv.user_b_id,
        peer_id=peer.id,
        peer_username=peer.username,
        peer_display_name=peer.display_name,
        peer_avatar_url=peer.avatar_url,
        peer_status=peer.status,
        last_message=last_msg,
        last_message_at=last_msg_at,
        unread_count=unread_count,
        created_at=conv.created_at,
    )


async def _count_unread_messages(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    current_user_id: uuid.UUID,
    last_read_at,
) -> int:
    statement = select(func.count(Message.id)).where(
        Message.channel_id == conversation_id,
        Message.sender_id != current_user_id,
    )
    if last_read_at is not None:
        statement = statement.where(Message.created_at > last_read_at)
    count = await session.scalar(statement)
    return int(count or 0)


@router.get("/conversations", response_model=list[DMConversationRead])
async def list_dm_conversations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all DM conversations for the current user, with last message info."""
    # Get all conversations involving the current user
    result = await session.execute(
        select(DMConversation).where(
            or_(
                DMConversation.user_a_id == current_user.id,
                DMConversation.user_b_id == current_user.id,
            )
        )
    )
    conversations = list(result.scalars().all())
    read_states_by_conversation: dict[uuid.UUID, ReadState] = {}

    if conversations:
        read_state_result = await session.execute(
            select(ReadState).where(
                ReadState.user_id == current_user.id,
                ReadState.target_kind == ReadStateTarget.DM,
                ReadState.target_id.in_([conversation.id for conversation in conversations]),
            )
        )
        read_states_by_conversation = {
            state.target_id: state
            for state in read_state_result.scalars().all()
        }

    # For each conversation, get the last message and peer info
    out: list[DMConversationRead] = []
    for conv in conversations:
        peer_id = conv.user_b_id if conv.user_a_id == current_user.id else conv.user_a_id

        # Load peer user
        peer_result = await session.execute(select(User).where(User.id == peer_id))
        peer = peer_result.scalar_one_or_none()
        if peer is None:
            continue  # skip orphaned conversations

        # Get last message
        last_msg_result = await session.execute(
            select(Message)
            .where(Message.channel_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()
        read_state = read_states_by_conversation.get(conv.id)
        unread_count = await _count_unread_messages(
            session,
            conversation_id=conv.id,
            current_user_id=current_user.id,
            last_read_at=read_state.last_read_at if read_state else None,
        )

        out.append(_build_conversation_read(
            conv, peer,
            last_msg=last_msg.content if last_msg else None,
            last_msg_at=last_msg.created_at if last_msg else None,
            unread_count=unread_count,
        ))

    # Sort by most recent activity
    out.sort(key=lambda c: c.last_message_at or c.created_at, reverse=True)
    return out


@router.post("/conversations", response_model=DMConversationRead, status_code=status.HTTP_201_CREATED)
async def create_dm_conversation(
    body: DMConversationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a DM conversation with another user (or return existing one)."""
    if body.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create DM with yourself",
        )

    # Verify the target user exists
    peer_result = await session.execute(select(User).where(User.id == body.user_id))
    peer = peer_result.scalar_one_or_none()
    if peer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_a, user_b = _ordered_pair(current_user.id, body.user_id)

    # Check if conversation already exists
    existing_result = await session.execute(
        select(DMConversation).where(
            DMConversation.user_a_id == user_a,
            DMConversation.user_b_id == user_b,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return _build_conversation_read(existing, peer)

    # Create new conversation
    conv = DMConversation(user_a_id=user_a, user_b_id=user_b)
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return _build_conversation_read(conv, peer)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageRead])
@router.get(
    "/conversations/{conversation_id}/messages/",
    response_model=list[MessageRead],
    include_in_schema=False,
)
async def list_dm_messages(
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List messages in a DM conversation."""
    # Verify user is part of this conversation
    conv_result = await session.execute(
        select(DMConversation).where(DMConversation.id == conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if current_user.id not in (conv.user_a_id, conv.user_b_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this conversation")

    # DM messages use the conversation ID as their channel_id
    result = await session.execute(
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(Message.channel_id == conv.id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.reverse()

    payload = []
    for message in messages:
        payload.append(await build_message_read(message, current_user.id, session))
    return payload


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/conversations/{conversation_id}/messages/",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_dm_message(
    conversation_id: str,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Send a message in a DM conversation."""
    conv_result = await session.execute(
        select(DMConversation).where(DMConversation.id == conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if current_user.id not in (conv.user_a_id, conv.user_b_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this conversation")

    if body.reply_to_id is not None:
        ref_result = await session.execute(
            select(Message).where(
                Message.id == body.reply_to_id,
                Message.channel_id == conv.id,
            )
        )
        if ref_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Replied-to message not found in this conversation",
            )

    message = Message(
        channel_id=conv.id,
        sender_id=current_user.id,
        content=body.content,
        nonce=body.nonce,
        attachments=body.attachments,
        reply_to_id=body.reply_to_id,
    )
    session.add(message)
    await session.commit()

    result = await session.execute(
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(Message.id == message.id)
    )
    message = result.scalar_one()
    sync_result = await sync_dm_message_activity(session, message=message, actor=current_user, conversation=conv)
    await session.commit()
    await emit_message_domain_event(
        session,
        event_type="message_created",
        message=message,
        sender=current_user,
        actor=current_user,
        stream_kind="dm",
        stream_id=conv.id,
        conversation=conv,
    )
    await emit_message_activity_events(session, sync_result=sync_result, reason="dm_message_created")
    return await build_message_read(message, current_user.id, session)


@router.get("/users/search", response_model=list[dict])
async def search_users(
    q: str = Query(min_length=1, max_length=32),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Search for users by username (for starting new DMs)."""
    result = await session.execute(
        select(User)
        .where(
            User.username.ilike(f"%{q}%"),
            User.id != current_user.id,
        )
        .limit(20)
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "status": u.status,
        }
        for u in users
    ]
