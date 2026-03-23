"""Message mention model."""

import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class MessageMention(UUIDPrimaryKey, TimestampMixin, Base):
    """Tracks a user mention resolved from a persisted message."""

    __tablename__ = "message_mentions"
    __table_args__ = (
        UniqueConstraint("message_id", "mentioned_user_id", name="uq_message_mention_recipient"),
    )

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mentioned_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    message = relationship("Message", lazy="joined")
    mentioned_user = relationship("User", lazy="joined")
