"""Janus application entry point and FastAPI app factory.

Configures the FastAPI application, registers routers, and manages
the database lifecycle via the ASGI lifespan context.
"""

from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import auth, channels, servers
from app.core.config import settings
from app.core.database import engine
from app.models.base import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown.

    Creates database tables on startup and disposes the engine on shutdown.
    """
    # Create tables on startup (use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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


@app.get("/health")
async def health():
    """Return a simple health-check response."""
    return {"status": "ok", "service": "janus"}
