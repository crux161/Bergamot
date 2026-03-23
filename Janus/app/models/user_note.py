"""Per-user notes — user A can store a private note about user B."""

import uuid

from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class UserNote(UUIDPrimaryKey, TimestampMixin, Base):
    """A private note one user keeps about another user."""

    __tablename__ = "user_notes"
    __table_args__ = (
        UniqueConstraint("owner_id", "target_id", name="uq_user_note_pair"),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
