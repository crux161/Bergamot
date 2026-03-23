"""Session management routes for authenticated devices."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.auth_session import AuthSession
from app.models.user import User
from app.schemas.session import AuthSessionRead, RevokeOtherSessionsRead

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _serialize_session(auth_session: AuthSession, *, current_session_id: uuid.UUID | None) -> AuthSessionRead:
    return AuthSessionRead(
        id=auth_session.id,
        client_name=auth_session.client_name,
        user_agent=auth_session.user_agent,
        ip_address=auth_session.ip_address,
        created_at=auth_session.created_at,
        last_seen_at=auth_session.last_seen_at,
        expires_at=auth_session.expires_at,
        revoked_at=auth_session.revoked_at,
        current=auth_session.id == current_session_id,
    )


async def _touch_current_session(
    session: AsyncSession,
    *,
    request: Request,
    current_user: User,
) -> None:
    current_session_id = getattr(request.state, "current_session_id", None)
    if current_session_id is None:
        return

    result = await session.execute(
        select(AuthSession).where(
            AuthSession.id == current_session_id,
            AuthSession.user_id == current_user.id,
        )
    )
    auth_session = result.scalar_one_or_none()
    if auth_session is None:
        return

    now = datetime.now(timezone.utc)
    if (now - auth_session.last_seen_at).total_seconds() < 60:
        return

    auth_session.last_seen_at = now
    await session.commit()


@router.get("/", response_model=list[AuthSessionRead])
async def list_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List active sessions for the authenticated user."""
    await _touch_current_session(session, request=request, current_user=current_user)
    current_session_id = getattr(request.state, "current_session_id", None)

    result = await session.execute(
        select(AuthSession)
        .where(
            AuthSession.user_id == current_user.id,
            AuthSession.revoked_at.is_(None),
        )
        .order_by(AuthSession.last_seen_at.desc(), AuthSession.created_at.desc())
    )
    sessions = list(result.scalars().all())
    return [
        _serialize_session(item, current_session_id=current_session_id)
        for item in sessions
    ]


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Revoke a specific session belonging to the current user."""
    result = await session.execute(
        select(AuthSession).where(
            AuthSession.id == session_id,
            AuthSession.user_id == current_user.id,
            AuthSession.revoked_at.is_(None),
        )
    )
    auth_session = result.scalar_one_or_none()
    if auth_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    auth_session.revoked_at = datetime.now(timezone.utc)
    await session.commit()
    if auth_session.id == getattr(request.state, "current_session_id", None):
        request.state.current_session_id = None


@router.post("/revoke-others", response_model=RevokeOtherSessionsRead)
async def revoke_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Revoke every other active session for the authenticated user."""
    current_session_id = getattr(request.state, "current_session_id", None)
    if current_session_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current token is not session-backed. Sign in again to manage sessions.",
        )

    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(AuthSession)
        .where(
            AuthSession.user_id == current_user.id,
            AuthSession.revoked_at.is_(None),
            AuthSession.id != current_session_id,
        )
        .values(revoked_at=now)
        .returning(AuthSession.id)
    )
    revoked_ids = result.scalars().all()
    await session.commit()
    return RevokeOtherSessionsRead(revoked_count=len(revoked_ids))
