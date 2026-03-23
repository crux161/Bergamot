"""Message model for persisted chat messages."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Message(Base, UUIDPrimaryKey, TimestampMixin):
    """A chat message sent to a channel."""

    __tablename__ = "messages"

    # Bergamot uses a single persisted message model for both guild channels and
    # DM conversations. The target UUID is therefore stored without a strict FK
    # to `channels`, because DM conversation IDs share the same column.
    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    nonce: Mapped[str | None] = mapped_column(String(100))
    attachments: Mapped[dict | None] = mapped_column(JSONB)

    # Reply support — points to the message being replied to
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    # Edit tracking
    edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Pin tracking
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pinned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    pinned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    reply_to = relationship("Message", remote_side="Message.id", lazy="joined", uselist=False)
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan", lazy="selectin")
