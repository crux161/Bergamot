"""Passkey/WebAuthn routes for enrollment and passwordless sign-in."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.passkeys import (
    consume_passkey_challenge,
    decode_bytes,
    encode_bytes,
    ensure_allowed_origin,
    issue_passkey_challenge,
    resolve_webauthn_rp_id,
)
from app.core.security import create_access_token
from app.models.auth_session import AuthSession
from app.models.passkey_credential import PasskeyCredential
from app.models.user import User
from app.schemas.passkeys import (
    PasskeyAuthenticationFinish,
    PasskeyAuthenticationStart,
    PasskeyChallengeRead,
    PasskeyRead,
    PasskeyRegistrationFinish,
    PasskeyRegistrationStart,
)
from app.schemas.user import Token

router = APIRouter(prefix="/passkeys", tags=["passkeys"])


def _serialize_passkey(credential: PasskeyCredential) -> PasskeyRead:
    return PasskeyRead(
        id=credential.id,
        label=credential.label,
        created_at=credential.created_at,
        last_used_at=credential.last_used_at,
        transports=list(credential.transports or []),
    )


def _derive_client_name(request: Request) -> str:
    explicit = request.headers.get("x-bergamot-client")
    if explicit:
        return explicit[:160]
    user_agent = (request.headers.get("user-agent") or "").lower()
    if "electron" in user_agent:
        return "Proteus Desktop"
    if user_agent:
        return "Proteus Web"
    return "Unknown client"


def _derive_ip_address(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


@router.get("/", response_model=list[PasskeyRead])
async def list_passkeys(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List passkeys currently enrolled for the signed-in user."""
    result = await session.execute(
        select(PasskeyCredential)
        .where(PasskeyCredential.user_id == current_user.id)
        .order_by(PasskeyCredential.created_at.desc())
    )
    return [_serialize_passkey(item) for item in result.scalars().all()]


@router.post("/registration/options", response_model=PasskeyChallengeRead)
async def begin_passkey_registration(
    request: Request,
    body: PasskeyRegistrationStart,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Generate a WebAuthn registration challenge for the signed-in user."""
    ensure_allowed_origin(request)
    rp_id = resolve_webauthn_rp_id(request)
    rp_name = settings.WEBAUTHN_RP_NAME or settings.INSTANCE_NAME or "Bergamot"

    result = await session.execute(
        select(PasskeyCredential).where(PasskeyCredential.user_id == current_user.id)
    )
    existing = result.scalars().all()

    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=rp_name,
        user_id=str(current_user.id).encode("utf-8"),
        user_name=current_user.username,
        user_display_name=current_user.display_name or current_user.username,
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=decode_bytes(credential.credential_id))
            for credential in existing
        ],
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    flow_id = issue_passkey_challenge(
        kind="registration",
        challenge=options.challenge,
        user_id=current_user.id,
        label=(body.label or "Proteus Passkey").strip()[:120],
    )
    return PasskeyChallengeRead(
        challenge_id=flow_id,
        public_key=json.loads(options_to_json(options)),
    )


@router.post("/registration/verify", response_model=PasskeyRead, status_code=status.HTTP_201_CREATED)
async def finish_passkey_registration(
    request: Request,
    body: PasskeyRegistrationFinish,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Verify a WebAuthn attestation response and persist the new passkey."""
    origin = ensure_allowed_origin(request)
    rp_id = resolve_webauthn_rp_id(request)
    pending = consume_passkey_challenge(
        body.challenge_id,
        kind="registration",
        user_id=current_user.id,
    )

    verification = verify_registration_response(
        credential=body.credential,
        expected_challenge=pending.challenge,
        expected_origin=origin,
        expected_rp_id=rp_id,
        require_user_verification=True,
    )

    passkey = PasskeyCredential(
        user_id=current_user.id,
        label=pending.label or "Proteus Passkey",
        credential_id=encode_bytes(verification.credential_id),
        public_key=encode_bytes(verification.credential_public_key),
        sign_count=verification.sign_count,
        transports=body.credential.get("response", {}).get("transports") or [],
        last_used_at=datetime.now(timezone.utc),
    )
    session.add(passkey)
    await session.commit()
    await session.refresh(passkey)
    return _serialize_passkey(passkey)


@router.post("/authentication/options", response_model=PasskeyChallengeRead)
async def begin_passkey_authentication(
    request: Request,
    body: PasskeyAuthenticationStart,
    session: AsyncSession = Depends(get_session),
):
    """Generate a WebAuthn authentication challenge for passwordless sign-in."""
    ensure_allowed_origin(request)
    rp_id = resolve_webauthn_rp_id(request)

    user: User | None = None
    credentials: list[PasskeyCredential] = []
    if body.username:
        user_result = await session.execute(
            select(User).where(User.username == body.username)
        )
        user = user_result.scalar_one_or_none()
        if user is not None:
            credential_result = await session.execute(
                select(PasskeyCredential).where(PasskeyCredential.user_id == user.id)
            )
            credentials = credential_result.scalars().all()

    options = generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=decode_bytes(credential.credential_id))
            for credential in credentials
        ] or None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    flow_id = issue_passkey_challenge(
        kind="authentication",
        challenge=options.challenge,
        user_id=user.id if user is not None else None,
    )
    return PasskeyChallengeRead(
        challenge_id=flow_id,
        public_key=json.loads(options_to_json(options)),
    )


@router.post("/authentication/verify", response_model=Token)
async def finish_passkey_authentication(
    request: Request,
    body: PasskeyAuthenticationFinish,
    session: AsyncSession = Depends(get_session),
):
    """Verify a WebAuthn assertion response and issue a Janus session token."""
    origin = ensure_allowed_origin(request)
    rp_id = resolve_webauthn_rp_id(request)
    pending = consume_passkey_challenge(
        body.challenge_id,
        kind="authentication",
    )

    credential_id = body.credential.get("id")
    if not credential_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credential ID missing")

    result = await session.execute(
        select(PasskeyCredential).where(PasskeyCredential.credential_id == credential_id)
    )
    passkey = result.scalar_one_or_none()
    if passkey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found")
    if pending.user_id is not None and passkey.user_id != pending.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Passkey does not match the requested user")

    user_result = await session.execute(select(User).where(User.id == passkey.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.suspended_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=user.suspension_reason or "Account suspended",
        )

    verification = verify_authentication_response(
        credential=body.credential,
        expected_challenge=pending.challenge,
        expected_origin=origin,
        expected_rp_id=rp_id,
        credential_public_key=decode_bytes(passkey.public_key),
        credential_current_sign_count=passkey.sign_count,
        require_user_verification=True,
    )

    passkey.sign_count = verification.new_sign_count
    passkey.last_used_at = datetime.now(timezone.utc)

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = datetime.now(timezone.utc) + expires_delta
    auth_session = AuthSession(
        user_id=user.id,
        client_name=_derive_client_name(request),
        user_agent=(request.headers.get("user-agent") or None),
        ip_address=_derive_ip_address(request),
        expires_at=expires_at,
        last_seen_at=datetime.now(timezone.utc),
    )
    session.add(auth_session)
    session.add(passkey)
    await session.commit()
    await session.refresh(auth_session)

    token = create_access_token(
        subject=str(user.id),
        session_id=str(auth_session.id),
        expires_delta=expires_delta,
    )
    return Token(access_token=token, session_id=auth_session.id, expires_at=expires_at)


@router.delete("/{passkey_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_passkey(
    passkey_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a passkey enrolled by the current user."""
    result = await session.execute(
        select(PasskeyCredential).where(
            PasskeyCredential.id == passkey_id,
            PasskeyCredential.user_id == current_user.id,
        )
    )
    passkey = result.scalar_one_or_none()
    if passkey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found")

    await session.delete(passkey)
    await session.commit()
