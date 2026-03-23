"""DM (Direct Message) conversation model.

A DM conversation is a private channel between exactly two users.
The conversation ID doubles as the channel_id in the messages table,
so DM messages use the same Message model as server channel messages.
"""

import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class DMConversation(UUIDPrimaryKey, TimestampMixin, Base):
    """A direct-message conversation between two users.

    To ensure uniqueness regardless of who initiated, we store
    user_a_id < user_b_id (enforced at the application layer).
    """

    __tablename__ = "dm_conversations"

    user_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Relationships
    user_a = relationship("User", foreign_keys=[user_a_id], lazy="joined")
    user_b = relationship("User", foreign_keys=[user_b_id], lazy="joined")

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_dm_pair"),
    )
