"""Read-state model for channels and DM conversations."""

import uuid
from enum import Enum as PyEnum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class ReadStateTarget(str, PyEnum):
    """Supported read-state targets."""

    CHANNEL = "channel"
    DM = "dm"


class ReadState(UUIDPrimaryKey, TimestampMixin, Base):
    """Tracks a user's latest read point for a message stream."""

    __tablename__ = "read_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_kind: Mapped[ReadStateTarget] = mapped_column(
        Enum(ReadStateTarget, name="read_state_target_kind"),
        nullable=False,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    last_read_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "target_kind",
            "target_id",
            name="uq_read_state_user_target",
        ),
    )
