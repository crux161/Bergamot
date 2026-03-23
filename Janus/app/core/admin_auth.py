"""Helpers for global Bergamot admin access."""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User


def _parse_csv(raw: str | None) -> set[str]:
    if not raw:
        return set()
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def is_admin_user(user: User) -> bool:
    """Return whether the given user is allowed to access global admin routes."""
    usernames = _parse_csv(settings.ADMIN_USERNAMES)
    emails = _parse_csv(settings.ADMIN_EMAILS)
    user_ids = _parse_csv(settings.ADMIN_USER_IDS)
    if not usernames and not emails and not user_ids:
        return False

    if str(user.id).lower() in user_ids:
        return True
    if user.username.lower() in usernames:
        return True
    if user.email.lower() in emails:
        return True
    return False


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Require a globally configured Bergamot admin user."""
    if not (settings.ADMIN_USERNAMES or settings.ADMIN_EMAILS or settings.ADMIN_USER_IDS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is not configured for this instance",
        )

    if not is_admin_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access Bergamot Admin",
        )
    return current_user
