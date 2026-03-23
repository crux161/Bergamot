"""Temporary auth and entry-flow tickets used across Phase 1 surfaces."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class AuthFlowTicket(UUIDPrimaryKey, TimestampMixin, Base):
    """A short-lived token for auth-adjacent flows.

    Used for password resets, email verification, authorize-IP emails, and
    entry contexts such as invite/gift/theme links.
    """

    __tablename__ = "auth_flow_tickets"

    flow_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    email: Mapped[str | None] = mapped_column(String(320))
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
