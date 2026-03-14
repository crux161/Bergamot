"""Channel CRUD routes: create and list channels within a server."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.channel import Channel
from app.models.server import Server
from app.models.user import User
from app.schemas.channel import ChannelCreate, ChannelRead

router = APIRouter(prefix="/servers/{server_id}/channels", tags=["channels"])


@router.post("/", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)
async def create_channel(
    server_id: str,
    body: ChannelCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new channel in the given server.

    Only the server owner may create channels. The channel's position is
    set to the next available index.

    Raises:
        HTTPException: 404 if the server does not exist.
        HTTPException: 403 if the requesting user is not the server owner.
    """
    # Verify server exists and user is owner
    result = await session.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the server owner can create channels",
        )

    # Determine position
    count_result = await session.execute(
        select(Channel).where(Channel.server_id == server.id)
    )
    position = len(count_result.scalars().all())

    channel = Channel(
        name=body.name,
        topic=body.topic,
        channel_type=body.channel_type,
        position=position,
        server_id=server.id,
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
