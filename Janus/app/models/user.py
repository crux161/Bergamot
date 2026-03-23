"""User ORM model representing an authenticated Janus user."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class User(UUIDPrimaryKey, TimestampMixin, Base):
    """A registered user account.

    Attributes:
        username: Unique login name (max 32 chars).
        email: Unique email address (max 320 chars).
        password_hash: Bcrypt-hashed password.
        display_name: Optional display name shown in the UI.
        avatar_url: Optional URL to the user's avatar image.
        owned_servers: Servers this user owns.
        memberships: Server memberships for this user.
    """

    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(64))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    banner_url: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(16), default="online", nullable=False, server_default="online")
    status_message: Mapped[str | None] = mapped_column(String(128))
    is_bot: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    mfa_secret: Mapped[str | None] = mapped_column(String(64))
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    mfa_enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    email_verification_token: Mapped[str | None] = mapped_column(String(128))
    password_reset_token: Mapped[str | None] = mapped_column(String(128))
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspension_reason: Mapped[str | None] = mapped_column(Text)

    # Relationships
    owned_servers = relationship("Server", back_populates="owner", lazy="selectin")
    memberships = relationship("ServerMember", back_populates="user", lazy="selectin")
