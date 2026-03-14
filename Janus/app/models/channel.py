import uuid
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class ChannelType(str, PyEnum):
    TEXT = "text"
    VOICE = "voice"


class Channel(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "channels"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    topic: Mapped[str | None] = mapped_column(String(1024))
    channel_type: Mapped[ChannelType] = mapped_column(
        Enum(ChannelType, name="channel_type"), default=ChannelType.TEXT, nullable=False
    )
    position: Mapped[int] = mapped_column(default=0, nullable=False)
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    server = relationship("Server", back_populates="channels", lazy="joined")
