"""Persisted WebAuthn/passkey credentials."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class PasskeyCredential(UUIDPrimaryKey, TimestampMixin, Base):
    """A registered WebAuthn credential bound to a Bergamot user."""

    __tablename__ = "passkey_credentials"
    __table_args__ = (
        UniqueConstraint("credential_id", name="uq_passkey_credential_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False, default="Unnamed passkey")
    credential_id: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    public_key: Mapped[str] = mapped_column(String(4096), nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    transports: Mapped[list[str] | None] = mapped_column(JSONB)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", lazy="joined")
