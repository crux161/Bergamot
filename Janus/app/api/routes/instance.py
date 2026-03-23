"""Public instance discovery endpoints for clients and tooling."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from fastapi import APIRouter, Request

from app.core.config import settings
from app.schemas.instance import FeatureManifestRead, RuntimeConfigRead

router = APIRouter(prefix="/instance", tags=["instance"])

_FALLBACK_MANIFEST = {
    "manifestVersion": 1,
    "product": {
        "name": "Bergamot",
        "tagline": "Polyglot communities, chat, and calls across the Bergamot ecosystem.",
    },
    "capabilities": {
        "routeShell": True,
        "favorites": True,
        "quickSwitcher": True,
        "customThemes": True,
        "localNotifications": True,
        "replies": True,
        "reactions": True,
        "pins": True,
        "inbox": True,
        "mentions": True,
        "savedItems": True,
        "messageSearch": True,
        "readStates": True,
        "customEmoji": False,
        "stickers": False,
        "gifPicker": False,
        "sessions": True,
        "accountSwitching": True,
        "mfa": True,
        "passkeys": True,
        "oauth": True,
        "pushNotifications": False,
        "voiceDevices": False,
        "participantModeration": False,
        "bots": False,
        "webhooks": False,
        "discovery": False,
    },
    "routes": {
        "login": "/login",
        "register": "/register",
        "dmHome": "/channels/@me",
        "notifications": "/notifications",
        "favorites": "/favorites",
    },
}


def _default_public_base_url(request: Request) -> str:
    return settings.PUBLIC_BASE_URL or str(request.base_url).rstrip("/")


def _build_websocket_base_url(request: Request) -> str:
    if settings.HERMES_PUBLIC_URL:
        return settings.HERMES_PUBLIC_URL.rstrip("/")

    return _with_port(_default_public_base_url(request), 4000, websocket=True) + "/socket"


def _with_port(base_url: str, port: int, websocket: bool = False) -> str:
    parsed = urlsplit(base_url)
    scheme = parsed.scheme
    if websocket:
        scheme = "wss" if parsed.scheme == "https" else "ws"

    hostname = parsed.hostname or "localhost"
    netloc = f"{hostname}:{port}"
    return urlunsplit((scheme, netloc, "", "", "")).rstrip("/")


def _contracts_manifest_path() -> Path:
    return Path(__file__).resolve().parents[4] / "packages" / "contracts" / "data" / "instance-manifest.json"


@lru_cache(maxsize=1)
def _load_contract_manifest() -> dict:
    try:
        with _contracts_manifest_path().open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return _FALLBACK_MANIFEST


@router.get("/config", response_model=RuntimeConfigRead)
async def get_runtime_config(request: Request):
    """Return public service URLs and product metadata for Bergamot clients."""
    manifest = _load_contract_manifest()
    http_base = _default_public_base_url(request)

    return {
        "manifest_version": manifest["manifestVersion"],
        "product": {
            "name": settings.INSTANCE_NAME,
            "tagline": settings.INSTANCE_TAGLINE,
        },
        "services": {
            "http_base_url": http_base,
            "api_base_url": f"{http_base}{settings.API_V1_PREFIX}",
            "websocket_base_url": _build_websocket_base_url(request),
            "uploads_base_url": f"{http_base}/uploads",
            "media_base_url": settings.MEDIA_PUBLIC_URL or _with_port(http_base, 9100),
            "admin_base_url": settings.ADMIN_PUBLIC_URL or _with_port(http_base, 9101),
            "livekit_base_url": settings.LIVEKIT_PUBLIC_URL or _with_port(http_base, 7880),
        },
    }


@router.get("/features", response_model=FeatureManifestRead)
async def get_feature_manifest():
    """Return the shared capability manifest that clients can hydrate from."""
    manifest = _load_contract_manifest()
    return {
        "manifest_version": manifest["manifestVersion"],
        "product": {
            "name": settings.INSTANCE_NAME,
            "tagline": settings.INSTANCE_TAGLINE,
        },
        "capabilities": manifest["capabilities"],
        "routes": manifest["routes"],
    }
