"""Saved items model for server-backed favorites."""

import uuid

from sqlalchemy import Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.enums import SavedItemKind


class SavedItem(UUIDPrimaryKey, TimestampMixin, Base):
    """A favorited channel or DM conversation."""

    __tablename__ = "saved_items"
    __table_args__ = (
        UniqueConstraint("user_id", "kind", "target_id", name="uq_saved_item_user_target"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[SavedItemKind] = mapped_column(
        Enum(SavedItemKind, name="saved_item_kind"),
        nullable=False,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    user = relationship("User", lazy="joined")
