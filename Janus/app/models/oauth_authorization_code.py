"""Short-lived authorization codes for the OAuth2 authorization-code flow."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class OAuthAuthorizationCode(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "oauth_authorization_codes"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("oauth_applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    redirect_uri: Mapped[str] = mapped_column(String(512), nullable=False)
    scopes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    state: Mapped[str | None] = mapped_column(String(256))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
