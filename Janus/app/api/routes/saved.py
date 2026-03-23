"""Saved item routes for server-backed favorites."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.realtime_bridge import emit_saved_item_updated
from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.enums import SavedItemKind
from app.models.message import Message
from app.models.saved_item import SavedItem
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.activity import SavedItemRead

router = APIRouter(prefix="/saved", tags=["saved"])


async def _build_saved_item_read(
    session: AsyncSession,
    *,
    current_user: User,
    item: SavedItem,
) -> SavedItemRead | None:
    if item.kind == SavedItemKind.CHANNEL:
        channel_result = await session.execute(select(Channel).where(Channel.id == item.target_id))
        channel = channel_result.scalar_one_or_none()
        if channel is None:
            return None
        server_result = await session.execute(select(Server).where(Server.id == channel.server_id))
        server = server_result.scalar_one_or_none()
        return SavedItemRead(
            id=f"{item.kind.value}:{channel.server_id}:{item.target_id}",
            kind=item.kind,
            target_id=item.target_id,
            label=f"#{channel.name}",
            subtitle=server.name if server else "Saved channel",
            route_hash=f"#/channels/{channel.server_id}/{channel.id}",
            icon="hash",
            created_at=item.created_at,
        )

    if item.kind == SavedItemKind.MESSAGE:
        msg_result = await session.execute(select(Message).where(Message.id == item.target_id))
        msg = msg_result.scalar_one_or_none()
        if msg is None:
            return None
        # Determine context for display
        snippet = (msg.content or "")[:100]
        author_result = await session.execute(select(User).where(User.id == msg.user_id))
        author = author_result.scalar_one_or_none()
        author_name = (author.display_name or author.username) if author else "Unknown"
        if msg.channel_id:
            ch_result = await session.execute(select(Channel).where(Channel.id == msg.channel_id))
            ch = ch_result.scalar_one_or_none()
            ch_name = f"#{ch.name}" if ch else "unknown channel"
            srv_result = await session.execute(select(Server).where(Server.id == ch.server_id)) if ch else None
            srv = srv_result.scalar_one_or_none() if srv_result else None
            subtitle = f"{author_name} in {ch_name}" + (f" · {srv.name}" if srv else "")
            route_hash = f"#/channels/{ch.server_id}/{ch.id}" if ch else "#"
        else:
            subtitle = f"Message from {author_name}"
            route_hash = "#/channels/@me"
        return SavedItemRead(
            id=f"message:{item.target_id}",
            kind=item.kind,
            target_id=item.target_id,
            label=snippet or "(no content)",
            subtitle=subtitle,
            route_hash=route_hash,
            icon="bookmark-simple",
            created_at=item.created_at,
        )

    conv_result = await session.execute(select(DMConversation).where(DMConversation.id == item.target_id))
    conversation = conv_result.scalar_one_or_none()
    if conversation is None:
        return None

    peer_id = conversation.user_b_id if conversation.user_a_id == current_user.id else conversation.user_a_id
    peer_result = await session.execute(select(User).where(User.id == peer_id))
    peer = peer_result.scalar_one_or_none()
    if peer is None:
        return None

    label = peer.display_name or peer.username
    return SavedItemRead(
        id=f"{item.kind.value}:{item.target_id}",
        kind=item.kind,
        target_id=item.target_id,
        label=label,
        subtitle=f"Direct message with @{peer.username}",
        route_hash=f"#/channels/@me/{conversation.id}",
        icon="at",
        created_at=item.created_at,
    )


async def _ensure_target_exists(
    session: AsyncSession,
    *,
    kind: SavedItemKind,
    target_id: uuid.UUID,
    current_user: User,
) -> None:
    if kind == SavedItemKind.CHANNEL:
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
        owner_result = await session.execute(
            select(Server.owner_id).where(Server.id == channel.server_id)
        )
        owner_id = owner_result.scalar_one_or_none()
        if member_result.scalar_one_or_none() is None and owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this channel")
        return

    if kind == SavedItemKind.MESSAGE:
        result = await session.execute(select(Message).where(Message.id == target_id))
        message = result.scalar_one_or_none()
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        return

    result = await session.execute(select(DMConversation).where(DMConversation.id == target_id))
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if current_user.id not in (conversation.user_a_id, conversation.user_b_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this conversation")


@router.get("/", response_model=list[SavedItemRead])
async def list_saved_items(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List saved channels and DM conversations for the current user."""
    result = await session.execute(
        select(SavedItem)
        .where(SavedItem.user_id == current_user.id)
        .order_by(SavedItem.created_at.desc())
    )
    items = []
    for item in result.scalars().all():
        rendered = await _build_saved_item_read(session, current_user=current_user, item=item)
        if rendered is not None:
            items.append(rendered)
    return items


@router.put("/{kind}/{target_id}", response_model=SavedItemRead, status_code=status.HTTP_201_CREATED)
async def save_item(
    kind: SavedItemKind,
    target_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Save a channel or DM conversation for the current user."""
    await _ensure_target_exists(session, kind=kind, target_id=target_id, current_user=current_user)
    result = await session.execute(
        select(SavedItem).where(
            SavedItem.user_id == current_user.id,
            SavedItem.kind == kind,
            SavedItem.target_id == target_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        item = SavedItem(user_id=current_user.id, kind=kind, target_id=target_id)
        session.add(item)
        await session.commit()
        await session.refresh(item)
        await emit_saved_item_updated(
            user_id=current_user.id,
            kind=kind,
            target_id=target_id,
            action="saved",
        )
    rendered = await _build_saved_item_read(session, current_user=current_user, item=item)
    if rendered is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved item target not found")
    return rendered


@router.delete("/{kind}/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unsave_item(
    kind: SavedItemKind,
    target_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a saved channel or DM conversation."""
    result = await session.execute(
        select(SavedItem).where(
            SavedItem.user_id == current_user.id,
            SavedItem.kind == kind,
            SavedItem.target_id == target_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved item not found")
    await session.delete(item)
    await session.commit()
    await emit_saved_item_updated(
        user_id=current_user.id,
        kind=kind,
        target_id=target_id,
        action="removed",
    )
