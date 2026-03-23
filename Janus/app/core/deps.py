"""FastAPI dependency providers for authentication and authorization."""

import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import decode_access_token_claims
from app.models.auth_session import AuthSession
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Resolve the authenticated user from the Bearer token.

    Raises:
        HTTPException: 401 if the token is invalid, expired, or the user
            does not exist.
    """
    claims = decode_access_token_claims(token)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    subject = claims.get("sub")
    try:
        user_id = uuid.UUID(str(subject))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    if user.suspended_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=user.suspension_reason or "Account suspended",
        )

    request.state.current_session_id = None
    raw_session_id = claims.get("sid")
    if raw_session_id is not None:
        try:
            session_id = uuid.UUID(str(raw_session_id))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token session",
            )

        session_result = await session.execute(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.user_id == user_id,
            )
        )
        auth_session = session_result.scalar_one_or_none()
        if (
            auth_session is None
            or auth_session.revoked_at is not None
            or auth_session.expires_at <= datetime.now(timezone.utc)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked",
            )
        request.state.current_session_id = auth_session.id

    return user
