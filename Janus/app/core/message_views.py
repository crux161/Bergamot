"""Shared message serializers used across Janus routes."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.message_reaction import MessageReaction
from app.schemas.message import ReactionCount


async def build_message_read(
    message: Message,
    current_user_id,
    session: AsyncSession,
) -> dict:
    """Build a MessageRead-compatible payload with reaction aggregates."""
    react_result = await session.execute(
        select(
            MessageReaction.emoji,
            func.count(MessageReaction.id).label("count"),
            func.bool_or(MessageReaction.user_id == current_user_id).label("me"),
        )
        .where(MessageReaction.message_id == message.id)
        .group_by(MessageReaction.emoji)
    )
    reaction_counts = [
        ReactionCount(emoji=row.emoji, count=row.count, me=bool(row.me))
        for row in react_result.all()
    ]

    reply_ref = None
    if message.reply_to is not None:
        reply_ref = {
            "id": message.reply_to.id,
            "sender_id": message.reply_to.sender_id,
            "content": message.reply_to.content,
            "created_at": message.reply_to.created_at,
        }

    return {
        "id": message.id,
        "channel_id": message.channel_id,
        "sender_id": message.sender_id,
        "content": message.content,
        "nonce": message.nonce,
        "attachments": message.attachments,
        "created_at": message.created_at,
        "reply_to_id": message.reply_to_id,
        "reply_to": reply_ref,
        "edited_at": message.edited_at,
        "pinned": message.pinned,
        "pinned_at": message.pinned_at,
        "pinned_by": message.pinned_by,
        "reaction_counts": reaction_counts,
    }
