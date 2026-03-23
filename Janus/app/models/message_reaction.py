"""MessageReaction model for emoji reactions on messages."""

import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class MessageReaction(Base, UUIDPrimaryKey, TimestampMixin):
    """A single user's reaction (emoji) on a message."""

    __tablename__ = "message_reactions"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Unicode emoji character or custom emoji identifier
    emoji: Mapped[str] = mapped_column(String(64), nullable=False)

    # Relationships
    message = relationship("Message", back_populates="reactions")
    user = relationship("User", lazy="joined")

    __table_args__ = (
        UniqueConstraint("message_id", "user_id", "emoji", name="uq_reaction_per_user"),
    )
