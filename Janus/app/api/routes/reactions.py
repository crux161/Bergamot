"""Reaction routes: add, remove, and list reactions on messages."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.message import Message
from app.models.message_reaction import MessageReaction
from app.models.user import User

router = APIRouter(
    prefix="/channels/{channel_id}/messages/{message_id}/reactions",
    tags=["reactions"],
)


@router.get("/{emoji}")
async def list_reactors(
    channel_id: str,
    message_id: str,
    emoji: str,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List users who reacted with a specific emoji."""
    result = await session.execute(
        select(MessageReaction)
        .where(
            MessageReaction.message_id == message_id,
            MessageReaction.emoji == emoji,
        )
        .order_by(MessageReaction.created_at)
        .limit(limit)
    )
    reactions = result.scalars().all()
    return [
        {
            "user_id": str(r.user_id),
            "username": r.user.username if r.user else None,
            "emoji": r.emoji,
        }
        for r in reactions
    ]


@router.put("/{emoji}/@me", status_code=status.HTTP_204_NO_CONTENT)
async def add_reaction(
    channel_id: str,
    message_id: str,
    emoji: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a reaction to a message. Idempotent."""
    # Verify message exists in this channel
    msg_result = await session.execute(
        select(Message).where(Message.id == message_id, Message.channel_id == channel_id)
    )
    if msg_result.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Check if already reacted
    existing = await session.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return  # Already reacted, idempotent

    reaction = MessageReaction(
        message_id=message_id,
        user_id=current_user.id,
        emoji=emoji,
    )
    session.add(reaction)
    await session.commit()


@router.delete("/{emoji}/@me", status_code=status.HTTP_204_NO_CONTENT)
async def remove_own_reaction(
    channel_id: str,
    message_id: str,
    emoji: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove the current user's reaction."""
    await session.execute(
        delete(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    await session.commit()


@router.delete("/{emoji}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_all_emoji_reactions(
    channel_id: str,
    message_id: str,
    emoji: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove all reactions for a specific emoji (requires MANAGE_MESSAGES)."""
    # TODO: permission check for MANAGE_MESSAGES
    await session.execute(
        delete(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.emoji == emoji,
        )
    )
    await session.commit()


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def remove_all_reactions(
    channel_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove all reactions from a message (requires MANAGE_MESSAGES)."""
    # TODO: permission check for MANAGE_MESSAGES
    await session.execute(
        delete(MessageReaction).where(MessageReaction.message_id == message_id)
    )
    await session.commit()
