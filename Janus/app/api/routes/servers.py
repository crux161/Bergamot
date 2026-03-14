"""Server CRUD routes: create, list, and retrieve servers."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.channel import Channel
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.server import ServerCreate, ServerRead

router = APIRouter(prefix="/servers", tags=["servers"])


@router.post("/", response_model=ServerRead, status_code=status.HTTP_201_CREATED)
async def create_server(
    body: ServerCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new server with a default ``#general`` channel.

    The requesting user is automatically added as owner and first member.
    """
    server = Server(name=body.name, owner_id=current_user.id)
    session.add(server)
    await session.flush()

    # Auto-create a #general text channel
    general = Channel(name="general", server_id=server.id, position=0)
    session.add(general)

    # Add owner as member
    membership = ServerMember(user_id=current_user.id, server_id=server.id)
    session.add(membership)

    await session.commit()
    await session.refresh(server)
    return server


@router.get("/", response_model=list[ServerRead])
async def list_my_servers(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all servers the current user is a member of."""
    result = await session.execute(
        select(Server)
        .join(ServerMember, ServerMember.server_id == Server.id)
        .where(ServerMember.user_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/{server_id}", response_model=ServerRead)
async def get_server(
    server_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Retrieve a single server by ID.

    Raises:
        HTTPException: 404 if the server does not exist.
    """
    result = await session.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server
