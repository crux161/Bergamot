"""Janus application entry point and FastAPI app factory.

Configures the FastAPI application, registers routers, and manages
the database lifecycle via the ASGI lifespan context.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.api.routes import auth, channels, messages, roles, servers, uploads
from app.core.config import settings
from app.core.database import engine
from app.models.base import Base


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
    from sqlalchemy import text

    async with engine.begin() as conn:
        for col_name, col_def in [
            ("banner_url", "VARCHAR(512)"),
            ("status", "VARCHAR(16) NOT NULL DEFAULT 'online'"),
            ("status_message", "VARCHAR(128)"),
        ]:
            try:
                await conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"
                ))
            except Exception:
                pass  # Column already exists
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

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(servers.router, prefix=settings.API_V1_PREFIX)
app.include_router(channels.router, prefix=settings.API_V1_PREFIX)
app.include_router(uploads.router, prefix=settings.API_V1_PREFIX)
app.include_router(messages.router, prefix=settings.API_V1_PREFIX)
app.include_router(roles.router, prefix=settings.API_V1_PREFIX)

# Ensure upload directory exists before mounting static files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Serve uploaded files as static assets
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health")
async def health():
    """Return a simple health-check response."""
    return {"status": "ok", "service": "janus"}
