"""Async SQLAlchemy engine and session factory.

Exposes ``engine``, ``async_session_factory``, and the
:func:`get_session` dependency used by FastAPI route handlers.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False, future=True)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session and close it on exit."""
    async with async_session_factory() as session:
        yield session
