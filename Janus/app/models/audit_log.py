import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class AuditLogEntry(UUIDPrimaryKey, TimestampMixin, Base):
    """A record of a moderation or administrative action within a server."""

    __tablename__ = "audit_log_entries"

    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action_type: Mapped[int] = mapped_column(Integer, nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(64))
    reason: Mapped[str | None] = mapped_column(Text)
    extra: Mapped[str | None] = mapped_column(Text)

    # Relationships
    user = relationship("User", lazy="joined")
