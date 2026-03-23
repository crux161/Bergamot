"""Persistent end-user consent grants for OAuth applications."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class OAuthConsentGrant(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "oauth_consent_grants"
    __table_args__ = (
        UniqueConstraint("user_id", "application_id", name="uq_oauth_consent_user_app"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("oauth_applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scopes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
