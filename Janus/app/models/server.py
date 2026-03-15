import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Server(UUIDPrimaryKey, TimestampMixin, Base):
    """A 'Guild' — a community space containing channels and members."""

    __tablename__ = "servers"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon_url: Mapped[str | None] = mapped_column(String(512))
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    owner = relationship("User", back_populates="owned_servers", lazy="joined")
    channels = relationship(
        "Channel", back_populates="server", lazy="selectin", cascade="all, delete-orphan"
    )
    members = relationship(
        "ServerMember", back_populates="server", lazy="selectin", cascade="all, delete-orphan"
    )
    roles = relationship(
        "Role", back_populates="server", lazy="selectin", cascade="all, delete-orphan"
    )
