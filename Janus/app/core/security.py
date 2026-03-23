"""Password hashing and JWT token utilities.

Provides helpers for bcrypt password hashing/verification and
HS256 JSON Web Token creation/decoding.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Check *plain* password against a bcrypt *hashed* value."""
    return pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str,
    *,
    session_id: str | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT containing *subject* as the ``sub`` claim.

    Args:
        subject: Value stored in the token's ``sub`` claim (typically a user ID).
        expires_delta: Custom token lifetime. Defaults to
            :pyattr:`Settings.ACCESS_TOKEN_EXPIRE_MINUTES`.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    if session_id is not None:
        to_encode["sid"] = session_id
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token_claims(token: str) -> dict[str, Any] | None:
    """Return decoded claims or None if invalid."""
    try:
        return jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except JWTError:
        return None


def decode_access_token(token: str) -> str | None:
    """Return the subject (user id) or None if invalid."""
    payload = decode_access_token_claims(token)
    if payload is None:
        return None
    subject = payload.get("sub")
    return str(subject) if subject is not None else None


def generate_secure_token() -> str:
    """Generate a URL-safe random token for password resets and email verification."""
    return secrets.token_urlsafe(48)
