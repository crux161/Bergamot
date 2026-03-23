"""OAuth client applications owned by Bergamot users."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class OAuthApplication(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "oauth_applications"

    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(96), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    redirect_uri: Mapped[str] = mapped_column(String(512), nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    client_secret_hash: Mapped[str] = mapped_column(String(160), nullable=False)
    scopes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    bot_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    bot_token_hash: Mapped[str | None] = mapped_column(String(160))
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
