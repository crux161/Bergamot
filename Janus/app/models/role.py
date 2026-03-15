"""Role model — defines named permission sets within a server."""

import uuid

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Role(UUIDPrimaryKey, TimestampMixin, Base):
    """A named set of permissions that can be assigned to server members."""

    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("server_id", "name", name="uq_server_role_name"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))  # hex e.g. "#6b9362"
    permissions: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    server = relationship("Server", back_populates="roles", lazy="joined")
    member_roles = relationship(
        "MemberRole", back_populates="role", cascade="all, delete-orphan"
    )
