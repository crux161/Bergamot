"""Minimal TOTP helpers for session-backed MFA."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote, urlencode

TIME_STEP_SECONDS = 30
TOTP_DIGITS = 6


def generate_totp_secret(length: int = 20) -> str:
    """Generate a Base32-encoded TOTP secret."""
    return base64.b32encode(secrets.token_bytes(length)).decode("ascii").rstrip("=")


def build_otpauth_uri(*, secret: str, account_name: str, issuer: str) -> str:
    """Build an otpauth URI for authenticator apps."""
    label = quote(f"{issuer}:{account_name}")
    params = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": str(TOTP_DIGITS),
            "period": str(TIME_STEP_SECONDS),
        }
    )
    return f"otpauth://totp/{label}?{params}"


def _normalize_secret(secret: str) -> bytes:
    normalized = secret.strip().replace(" ", "").upper()
    padding = "=" * (-len(normalized) % 8)
    return base64.b32decode(normalized + padding, casefold=True)


def _generate_totp(secret: str, counter: int) -> str:
    key = _normalize_secret(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    truncated = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(truncated % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)


def verify_totp(
    secret: str,
    code: str | None,
    *,
    at_time: int | None = None,
    valid_window: int = 1,
) -> bool:
    """Verify a six-digit TOTP code within a small clock-skew window."""
    normalized_code = "".join(ch for ch in (code or "") if ch.isdigit())
    if len(normalized_code) != TOTP_DIGITS:
        return False

    current_time = at_time or int(time.time())
    counter = current_time // TIME_STEP_SECONDS
    for offset in range(-valid_window, valid_window + 1):
        expected = _generate_totp(secret, counter + offset)
        if secrets.compare_digest(expected, normalized_code):
            return True
    return False
