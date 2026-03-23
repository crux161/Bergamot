"""Schemas for MFA setup and verification."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class MfaStatusRead(BaseModel):
    enabled: bool
    pending_setup: bool
    enabled_at: datetime | None = None


class TotpSetupRead(BaseModel):
    enabled: bool
    pending_setup: bool
    secret: str
    otpauth_uri: str
    issuer: str
    account_name: str


class TotpCodePayload(BaseModel):
    code: str = Field(min_length=6, max_length=16)
