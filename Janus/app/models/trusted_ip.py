"""Trusted IP addresses approved for account sign-ins."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class TrustedIP(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "trusted_ips"
    __table_args__ = (
        UniqueConstraint("user_id", "ip_address", name="uq_trusted_ip_user_address"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    client_name: Mapped[str | None] = mapped_column(String(160))
    authorized_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
