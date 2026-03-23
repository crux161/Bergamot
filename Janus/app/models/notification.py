"""Notification model for mentions and replies."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.enums import NotificationType, StreamKind


class Notification(UUIDPrimaryKey, TimestampMixin, Base):
    """A persisted inbox notification for a user."""

    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint(
            "message_id",
            "user_id",
            "notification_type",
            name="uq_notification_message_recipient_type",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"),
        nullable=False,
    )
    stream_kind: Mapped[StreamKind] = mapped_column(
        Enum(StreamKind, name="notification_stream_kind"),
        nullable=False,
    )
    stream_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    payload: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)

    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    actor = relationship("User", foreign_keys=[actor_id], lazy="joined")
    message = relationship("Message", lazy="joined")
