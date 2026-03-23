"""Janus application entry point and FastAPI app factory.

Configures the FastAPI application, registers routers, and manages
the database lifecycle via the ASGI lifespan context.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.staticfiles import StaticFiles

from app.api.routes import (
    admin,
    audit_log,
    auth,
    bans,
    channels,
    connections,
    dm,
    friends,
    gifts,
    instance,
    invites,
    mentions,
    messages,
    notes,
    notifications,
    oauth2,
    passkeys,
    reactions,
    read_states,
    reports,
    roles,
    saved,
    search,
    sessions,
    mfa,
    servers,
    uploads,
)
from app.core.config import settings
from app.core.database import engine
from app.models.base import Base


async def _run_safe_alter(statement: str) -> None:
    """Apply a lightweight additive migration outside a shared transaction.

    PostgreSQL aborts the whole transaction after a failed DDL statement. Running
    each `ALTER TABLE` in its own transaction lets startup recover cleanly when a
    column already exists or one statement is temporarily invalid.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(text(statement))
    except Exception:
        # Additive startup migrations are best-effort in dev; Alembic should own prod.
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown.

    Creates database tables on startup and disposes the engine on shutdown.
    """
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Create tables on startup (use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Lightweight column migrations for dev (add missing columns to existing tables)
    user_column_migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url VARCHAR(512)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'online'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ",
    ]

    message_column_migrations = [
        "ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_channel_id_fkey",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE oauth_applications ADD COLUMN IF NOT EXISTS bot_user_id UUID REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE oauth_applications ADD COLUMN IF NOT EXISTS bot_token_hash VARCHAR(160)",
    ]

    for statement in user_column_migrations + message_column_migrations:
        await _run_safe_alter(statement)
    yield
    await engine.dispose()


app = FastAPI(
    title="Janus API",
    description="Core API & Identity Service — the gateway to Bergamot",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev, let everyone in. For prod, use ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audit_log.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(bans.router, prefix=settings.API_V1_PREFIX)
app.include_router(connections.router, prefix=settings.API_V1_PREFIX)
app.include_router(gifts.router, prefix=settings.API_V1_PREFIX)
app.include_router(instance.router, prefix=settings.API_V1_PREFIX)
app.include_router(invites.router, prefix=settings.API_V1_PREFIX)
app.include_router(servers.router, prefix=settings.API_V1_PREFIX)
app.include_router(channels.router, prefix=settings.API_V1_PREFIX)
app.include_router(uploads.router, prefix=settings.API_V1_PREFIX)
app.include_router(messages.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(oauth2.router, prefix=settings.API_V1_PREFIX)
app.include_router(mentions.router, prefix=settings.API_V1_PREFIX)
app.include_router(saved.router, prefix=settings.API_V1_PREFIX)
app.include_router(search.router, prefix=settings.API_V1_PREFIX)
app.include_router(sessions.router, prefix=settings.API_V1_PREFIX)
app.include_router(mfa.router, prefix=settings.API_V1_PREFIX)
app.include_router(passkeys.router, prefix=settings.API_V1_PREFIX)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)
app.include_router(read_states.router, prefix=settings.API_V1_PREFIX)
app.include_router(roles.router, prefix=settings.API_V1_PREFIX)
app.include_router(dm.router, prefix=settings.API_V1_PREFIX)
app.include_router(friends.router, prefix=settings.API_V1_PREFIX)
app.include_router(reactions.router, prefix=settings.API_V1_PREFIX)
app.include_router(notes.router, prefix=settings.API_V1_PREFIX)

# Ensure upload directory exists before mounting static files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Serve uploaded files as static assets
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health")
async def health():
    """Return a simple health-check response."""
    return {"status": "ok", "service": "janus"}
