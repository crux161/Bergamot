"""TOTP-based MFA routes for authenticated users."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.totp import build_otpauth_uri, generate_totp_secret, verify_totp
from app.models.user import User
from app.schemas.mfa import MfaStatusRead, TotpCodePayload, TotpSetupRead

router = APIRouter(prefix="/mfa", tags=["mfa"])


def _issuer_name() -> str:
    return settings.INSTANCE_NAME or "Bergamot"


@router.get("/totp/status", response_model=MfaStatusRead)
async def get_totp_status(current_user: User = Depends(get_current_user)):
    """Return the current TOTP MFA state for the signed-in user."""
    return MfaStatusRead(
        enabled=current_user.mfa_enabled,
        pending_setup=bool(current_user.mfa_secret and not current_user.mfa_enabled),
        enabled_at=current_user.mfa_enabled_at,
    )


@router.post("/totp/setup", response_model=TotpSetupRead)
async def begin_totp_setup(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create or rotate a pending TOTP secret for the signed-in user."""
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="MFA is already enabled; disable it before rotating the secret",
        )

    secret = generate_totp_secret()
    current_user.mfa_secret = secret
    current_user.mfa_enabled = False
    current_user.mfa_enabled_at = None
    session.add(current_user)
    await session.commit()
    account_name = current_user.email or current_user.username
    return TotpSetupRead(
        enabled=False,
        pending_setup=True,
        secret=secret,
        otpauth_uri=build_otpauth_uri(secret=secret, account_name=account_name, issuer=_issuer_name()),
        issuer=_issuer_name(),
        account_name=account_name,
    )


@router.post("/totp/enable", response_model=MfaStatusRead)
async def enable_totp(
    body: TotpCodePayload,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Enable TOTP MFA once the user proves they can generate a valid code."""
    if not current_user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending MFA setup found")
    if current_user.mfa_enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="MFA is already enabled")
    if not verify_totp(current_user.mfa_secret, body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA code")

    current_user.mfa_enabled = True
    current_user.mfa_enabled_at = datetime.now(timezone.utc)
    session.add(current_user)
    await session.commit()
    return MfaStatusRead(enabled=True, pending_setup=False, enabled_at=current_user.mfa_enabled_at)


@router.post("/totp/disable", response_model=MfaStatusRead)
async def disable_totp(
    body: TotpCodePayload,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Disable TOTP MFA after verifying a current code."""
    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA is not enabled")
    if not verify_totp(current_user.mfa_secret, body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA code")

    current_user.mfa_secret = None
    current_user.mfa_enabled = False
    current_user.mfa_enabled_at = None
    session.add(current_user)
    await session.commit()
    return MfaStatusRead(enabled=False, pending_setup=False, enabled_at=None)
