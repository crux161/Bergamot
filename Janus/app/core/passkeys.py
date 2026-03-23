"""WebAuthn/passkey helpers and short-lived challenge storage."""

from __future__ import annotations

import base64
import secrets
import time
import uuid
from dataclasses import dataclass
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, status
from webauthn import base64url_to_bytes

from app.core.config import settings

PASSKEY_CHALLENGE_TTL_SECONDS = 300


@dataclass(slots=True)
class PendingPasskeyChallenge:
    kind: str
    challenge: bytes
    user_id: uuid.UUID | None
    label: str | None
    created_at: float


_pending_challenges: dict[str, PendingPasskeyChallenge] = {}


def _cleanup_expired_challenges() -> None:
    cutoff = time.time() - PASSKEY_CHALLENGE_TTL_SECONDS
    expired = [
        flow_id
        for flow_id, pending in _pending_challenges.items()
        if pending.created_at < cutoff
    ]
    for flow_id in expired:
        _pending_challenges.pop(flow_id, None)


def issue_passkey_challenge(
    *,
    kind: str,
    challenge: bytes,
    user_id: uuid.UUID | None = None,
    label: str | None = None,
) -> str:
    """Store a short-lived registration or authentication challenge."""
    _cleanup_expired_challenges()
    flow_id = secrets.token_urlsafe(24)
    _pending_challenges[flow_id] = PendingPasskeyChallenge(
        kind=kind,
        challenge=challenge,
        user_id=user_id,
        label=label,
        created_at=time.time(),
    )
    return flow_id


def consume_passkey_challenge(
    flow_id: str,
    *,
    kind: str,
    user_id: uuid.UUID | None = None,
) -> PendingPasskeyChallenge:
    """Load and remove a previously issued passkey challenge."""
    _cleanup_expired_challenges()
    pending = _pending_challenges.pop(flow_id, None)
    if pending is None or pending.kind != kind:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passkey challenge expired or invalid",
        )
    if user_id is not None and pending.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Passkey challenge does not belong to the current user",
        )
    return pending


def resolve_webauthn_rp_id(request: Request) -> str:
    """Resolve the RP ID used for WebAuthn challenges and verification."""
    if settings.WEBAUTHN_RP_ID:
        return settings.WEBAUTHN_RP_ID
    hostname = urlsplit(settings.PUBLIC_BASE_URL or str(request.base_url)).hostname
    return hostname or "localhost"


def resolve_allowed_webauthn_origins(request: Request) -> list[str]:
    """Resolve the set of allowed origins for WebAuthn responses."""
    if settings.WEBAUTHN_ALLOWED_ORIGINS:
        return [
            origin.strip().rstrip("/")
            for origin in settings.WEBAUTHN_ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    base = settings.PUBLIC_BASE_URL or str(request.base_url).rstrip("/")
    return [base]


def resolve_request_origin(request: Request) -> str:
    """Resolve the origin header expected by WebAuthn verification."""
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    return (settings.PUBLIC_BASE_URL or str(request.base_url)).rstrip("/")


def ensure_allowed_origin(request: Request) -> str:
    """Ensure the incoming origin is allowed for WebAuthn operations."""
    origin = resolve_request_origin(request)
    allowed = resolve_allowed_webauthn_origins(request)
    if origin not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Origin is not allowed for passkey operations",
        )
    return origin


def encode_bytes(value: bytes) -> str:
    """Encode bytes using WebAuthn base64url rules."""
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def decode_bytes(value: str) -> bytes:
    """Decode a WebAuthn base64url string into bytes."""
    return base64url_to_bytes(value)
