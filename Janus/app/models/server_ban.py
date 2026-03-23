import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class ServerBan(UUIDPrimaryKey, TimestampMixin, Base):
    """A ban record preventing a user from rejoining a server."""

    __tablename__ = "server_bans"
    __table_args__ = (
        UniqueConstraint("server_id", "user_id", name="uq_server_ban"),
    )

    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    banned_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(Text)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    banned_by = relationship("User", foreign_keys=[banned_by_id], lazy="joined")
