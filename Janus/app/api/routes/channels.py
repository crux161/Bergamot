"""Channel CRUD routes: create, list, and delete channels within a server."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.permissions import Permission, PermissionContext, RequirePermission
from app.models.channel import Channel
from app.models.user import User
from app.schemas.channel import ChannelCreate, ChannelRead

router = APIRouter(prefix="/servers/{server_id}/channels", tags=["channels"])


@router.post("/", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)
async def create_channel(
    server_id: str,
    body: ChannelCreate,
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_CHANNELS)),
    session: AsyncSession = Depends(get_session),
):
    """Create a new channel in the given server.

    Requires the MANAGE_CHANNELS permission.
    """
    # Determine position
    count_result = await session.execute(
        select(Channel).where(Channel.server_id == ctx.server.id)
    )
    position = len(count_result.scalars().all())

    channel = Channel(
        name=body.name,
        topic=body.topic,
        channel_type=body.channel_type,
        position=position,
        server_id=ctx.server.id,
    )
    session.add(channel)
    await session.commit()
    await session.refresh(channel)
    return channel


@router.get("/", response_model=list[ChannelRead])
async def list_channels(
    server_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all channels in a server, ordered by position."""
    result = await session.execute(
        select(Channel).where(Channel.server_id == server_id).order_by(Channel.position)
    )
    return result.scalars().all()


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    server_id: str,
    channel_id: str,
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_CHANNELS)),
    session: AsyncSession = Depends(get_session),
):
    """Delete a channel. Requires the MANAGE_CHANNELS permission."""
    result = await session.execute(
        select(Channel).where(Channel.id == channel_id, Channel.server_id == server_id)
    )
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Channel not found")

    await session.delete(channel)
    await session.commit()
