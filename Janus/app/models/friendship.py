"""Friendship / relationship model between users."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Friendship(UUIDPrimaryKey, TimestampMixin, Base):
    """A directional relationship between two users.

    Relationship types mirror Rival's model:
      1 = friend (mutual, stored as two rows)
      2 = blocked
      3 = incoming_request (the other user sent a request TO this user)
      4 = outgoing_request (this user sent a request TO the other user)
    """

    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_id", "peer_id", name="uq_friendship_pair"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    peer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relationship_type: Mapped[int] = mapped_column(Integer, nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(64))

    peer = relationship("User", foreign_keys=[peer_id], lazy="selectin")
