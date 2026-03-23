"""Linked external identities such as GitHub or Spotify accounts."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class ExternalConnection(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "external_connections"
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_external_provider_account"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    provider_account_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(128))
    display_name: Mapped[str | None] = mapped_column(String(160))
    profile_url: Mapped[str | None] = mapped_column(String(512))
    connection_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
