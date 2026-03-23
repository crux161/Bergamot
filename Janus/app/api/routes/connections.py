"""Linked external account routes."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.security import generate_secure_token
from app.models.auth_flow_ticket import AuthFlowTicket
from app.models.external_connection import ExternalConnection
from app.models.user import User
from app.schemas.connections import (
    ExternalConnectionCreate,
    ExternalConnectionLinkComplete,
    ExternalConnectionLinkStartRead,
    ExternalConnectionLinkStartRequest,
    ExternalConnectionProviderRead,
    ExternalConnectionRead,
)

router = APIRouter(prefix="/connections", tags=["connections"])

SUPPORTED_PROVIDERS = {"github", "gitlab", "spotify", "steam", "twitch"}
FLOW_CONNECTION_LINK = "connection_link"
PROVIDER_CONFIG: dict[str, dict[str, object]] = {
    "github": {
        "label": "GitHub",
        "description": "Link GitHub for profile badges, developer identity, and future SSO.",
        "default_scopes": ["read:user", "user:email"],
        "profile_url_template": "https://github.com/{username}",
    },
    "gitlab": {
        "label": "GitLab",
        "description": "Link GitLab for source control identity and developer tooling.",
        "default_scopes": ["read_user"],
        "profile_url_template": "https://gitlab.com/{username}",
    },
    "spotify": {
        "label": "Spotify",
        "description": "Link Spotify so Bergamot can reflect listening identity in social surfaces.",
        "default_scopes": ["user-read-email", "user-read-private"],
        "profile_url_template": "https://open.spotify.com/user/{username}",
    },
    "steam": {
        "label": "Steam",
        "description": "Link Steam to carry your gaming identity into profile and presence surfaces.",
        "default_scopes": ["read_profile"],
        "profile_url_template": "https://steamcommunity.com/id/{username}",
    },
    "twitch": {
        "label": "Twitch",
        "description": "Link Twitch for creator identity and future live-status integrations.",
        "default_scopes": ["user:read:email"],
        "profile_url_template": "https://www.twitch.tv/{username}",
    },
}


def _provider_meta(provider: str) -> dict[str, object]:
    normalized = provider.lower()
    if normalized not in PROVIDER_CONFIG:
        raise HTTPException(status_code=404, detail="Unsupported provider")
    return PROVIDER_CONFIG[normalized]


def _sanitize_handle(value: str | None, *, fallback: str) -> str:
    candidate = (value or fallback or "").strip()
    candidate = re.sub(r"[^A-Za-z0-9._-]+", "-", candidate).strip("-._")
    return candidate[:48] or fallback[:48] or f"bergamot_{generate_secure_token()[:8].lower()}"


def _build_link_preview(
    provider: str,
    meta: dict[str, object],
    *,
    current_user: User,
    account_hint: str | None,
    display_name: str | None,
) -> dict[str, object]:
    username = _sanitize_handle(account_hint, fallback=current_user.username)
    provider_account_id = f"{provider}_{username}_{generate_secure_token()[:6].lower()}"[:128]
    resolved_display_name = (display_name or current_user.display_name or current_user.username)[:160]
    template = meta.get("profile_url_template")
    profile_url = template.format(username=username) if isinstance(template, str) and username else None
    return {
        "provider": provider,
        "provider_label": str(meta["label"]),
        "provider_account_id": provider_account_id,
        "username": username,
        "display_name": resolved_display_name,
        "profile_url": profile_url,
        "description": str(meta["description"]),
        "default_scopes": list(meta.get("default_scopes") or []),
    }


def _connection_read(connection: ExternalConnection) -> ExternalConnectionRead:
    metadata = dict(connection.connection_metadata or {})
    provider_label = metadata.get("provider_label")
    if not provider_label and connection.provider in PROVIDER_CONFIG:
        provider_label = PROVIDER_CONFIG[connection.provider]["label"]
    return ExternalConnectionRead(
        id=connection.id,
        provider=connection.provider,
        provider_label=provider_label if isinstance(provider_label, str) else None,
        provider_account_id=connection.provider_account_id,
        username=connection.username,
        display_name=connection.display_name,
        profile_url=connection.profile_url,
        connection_metadata=metadata or None,
        linked_at=connection.linked_at,
        last_used_at=connection.last_used_at,
    )


async def _upsert_connection(
    session: AsyncSession,
    *,
    provider: str,
    payload: ExternalConnectionCreate,
    current_user: User,
    metadata: dict | None = None,
) -> ExternalConnection:
    existing_result = await session.execute(
        select(ExternalConnection).where(
            ExternalConnection.provider == provider,
            ExternalConnection.provider_account_id == payload.provider_account_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None and existing.user_id != current_user.id:
        raise HTTPException(status_code=409, detail="This external account is already linked")

    result = await session.execute(
        select(ExternalConnection).where(
            ExternalConnection.user_id == current_user.id,
            ExternalConnection.provider == provider,
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        connection = ExternalConnection(
            user_id=current_user.id,
            provider=provider,
            provider_account_id=payload.provider_account_id,
            linked_at=datetime.now(timezone.utc),
        )
        session.add(connection)

    connection.provider_account_id = payload.provider_account_id
    connection.username = payload.username
    connection.display_name = payload.display_name
    connection.profile_url = payload.profile_url
    connection.last_used_at = datetime.now(timezone.utc)
    if metadata is not None:
        connection.connection_metadata = metadata
    return connection


@router.get("/providers", response_model=list[ExternalConnectionProviderRead])
async def list_connection_providers():
    return [
        ExternalConnectionProviderRead(
            id=provider,
            label=str(meta["label"]),
            description=str(meta["description"]),
            default_scopes=list(meta.get("default_scopes") or []),
            profile_url_template=meta.get("profile_url_template") if isinstance(meta.get("profile_url_template"), str) else None,
            supports_login=True,
            supports_linking=True,
        )
        for provider, meta in PROVIDER_CONFIG.items()
    ]


@router.get("/", response_model=list[ExternalConnectionRead])
async def list_connections(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ExternalConnection).where(ExternalConnection.user_id == current_user.id)
    )
    return [_connection_read(connection) for connection in result.scalars().all()]


@router.post("/{provider}", response_model=ExternalConnectionRead, status_code=status.HTTP_201_CREATED)
async def upsert_connection(
    provider: str,
    body: ExternalConnectionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    provider = provider.lower()
    meta = _provider_meta(provider)
    connection = await _upsert_connection(
        session,
        provider=provider,
        payload=body,
        current_user=current_user,
        metadata={
            "provider_label": meta["label"],
            "default_scopes": list(meta.get("default_scopes") or []),
            "link_source": "manual",
        },
    )

    await session.commit()
    await session.refresh(connection)
    return _connection_read(connection)


@router.post("/{provider}/start", response_model=ExternalConnectionLinkStartRead)
async def begin_link_connection(
    provider: str,
    body: ExternalConnectionLinkStartRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    provider = provider.lower()
    meta = _provider_meta(provider)
    preview = _build_link_preview(
        provider,
        meta,
        current_user=current_user,
        account_hint=body.account_hint,
        display_name=body.display_name,
    )
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    ticket = AuthFlowTicket(
        flow_type=FLOW_CONNECTION_LINK,
        token=generate_secure_token(),
        user_id=current_user.id,
        payload=preview,
        expires_at=expires_at,
        notes=f"Link external {provider} account",
    )
    session.add(ticket)
    await session.commit()
    return ExternalConnectionLinkStartRead(
        challenge_id=ticket.token,
        provider=provider,
        provider_label=str(preview["provider_label"]),
        provider_account_id=str(preview["provider_account_id"]),
        username=preview["username"] if isinstance(preview["username"], str) else None,
        display_name=preview["display_name"] if isinstance(preview["display_name"], str) else None,
        profile_url=preview["profile_url"] if isinstance(preview["profile_url"], str) else None,
        description=str(preview["description"]),
        default_scopes=list(preview.get("default_scopes") or []),
        expires_at=expires_at,
    )


@router.post("/{provider}/complete", response_model=ExternalConnectionRead)
async def complete_link_connection(
    provider: str,
    body: ExternalConnectionLinkComplete,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    provider = provider.lower()
    meta = _provider_meta(provider)
    result = await session.execute(
        select(AuthFlowTicket).where(
            AuthFlowTicket.token == body.challenge_id,
            AuthFlowTicket.flow_type == FLOW_CONNECTION_LINK,
        )
    )
    ticket = result.scalar_one_or_none()
    if (
        ticket is None
        or ticket.user_id != current_user.id
        or ticket.consumed_at is not None
        or ticket.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="This connection authorization has expired")

    payload = dict(ticket.payload or {})
    if payload.get("provider") != provider:
        raise HTTPException(status_code=400, detail="This connection authorization does not match the selected provider")

    connection = await _upsert_connection(
        session,
        provider=provider,
        current_user=current_user,
        payload=ExternalConnectionCreate(
            provider_account_id=body.provider_account_id or str(payload.get("provider_account_id") or ""),
            username=body.username if body.username is not None else payload.get("username"),
            display_name=body.display_name if body.display_name is not None else payload.get("display_name"),
            profile_url=body.profile_url if body.profile_url is not None else payload.get("profile_url"),
        ),
        metadata={
            "provider_label": meta["label"],
            "default_scopes": list(meta.get("default_scopes") or []),
            "link_source": "guided",
            "linked_via_ticket": True,
        },
    )
    ticket.consumed_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(connection)
    return _connection_read(connection)


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ExternalConnection).where(
            ExternalConnection.id == connection_id,
            ExternalConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise HTTPException(status_code=404, detail="Linked account not found")

    await session.delete(connection)
    await session.commit()
    return {"ok": True}
