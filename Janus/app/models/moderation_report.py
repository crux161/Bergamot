"""Moderation reports submitted by users and reviewed by admins."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class ModerationReport(UUIDPrimaryKey, TimestampMixin, Base):
    """A user-submitted moderation report for messages, users, or servers."""

    __tablename__ = "moderation_reports"

    reporter_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_server_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("servers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="open", server_default="open")
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message_excerpt: Mapped[str | None] = mapped_column(Text)
    target_username_snapshot: Mapped[str | None] = mapped_column(String(64))
    server_name_snapshot: Mapped[str | None] = mapped_column(String(100))

    reporter = relationship("User", foreign_keys=[reporter_user_id], lazy="joined")
    target_user = relationship("User", foreign_keys=[target_user_id], lazy="joined")
    target_message = relationship("Message", foreign_keys=[target_message_id], lazy="joined")
    target_server = relationship("Server", foreign_keys=[target_server_id], lazy="joined")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id], lazy="joined")
