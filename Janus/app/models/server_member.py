import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class ServerMember(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "server_members"
    __table_args__ = (
        UniqueConstraint("user_id", "server_id", name="uq_user_server"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False
    )
    nickname: Mapped[str | None] = mapped_column(String(64))

    # Relationships
    user = relationship("User", back_populates="memberships", lazy="joined")
    server = relationship("Server", back_populates="members", lazy="joined")
    member_roles = relationship(
        "MemberRole", back_populates="member", lazy="selectin", cascade="all, delete-orphan"
    )
