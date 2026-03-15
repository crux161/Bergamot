"""Server CRUD routes: create, list, and retrieve servers."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.permissions import (
    DEFAULT_EVERYONE_PERMISSIONS,
    compute_permissions,
)
from app.models.channel import Channel
from app.models.member_role import MemberRole
from app.models.role import Role
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.role import MemberRead
from app.schemas.server import ServerCreate, ServerRead

router = APIRouter(prefix="/servers", tags=["servers"])


@router.post("/", response_model=ServerRead, status_code=status.HTTP_201_CREATED)
async def create_server(
    body: ServerCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new server with a default ``#general`` channel and @everyone role.

    The requesting user is automatically added as owner and first member.
    """
    server = Server(name=body.name, owner_id=current_user.id)
    session.add(server)
    await session.flush()

    # Auto-create a #general text channel
    general = Channel(name="general", server_id=server.id, position=0)
    session.add(general)

    # Auto-create the @everyone role with default permissions
    everyone_role = Role(
        name="@everyone",
        server_id=server.id,
        permissions=DEFAULT_EVERYONE_PERMISSIONS,
        position=0,
        is_default=True,
    )
    session.add(everyone_role)

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
    """Retrieve a single server by ID."""
    result = await session.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server


@router.get("/{server_id}/members", response_model=list[MemberRead])
async def list_members(
    server_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all members of a server with their assigned role IDs."""
    result = await session.execute(
        select(ServerMember).where(ServerMember.server_id == server_id)
    )
    members = result.scalars().all()

    out = []
    for m in members:
        user = m.user
        role_ids = [mr.role_id for mr in (m.member_roles or [])]
        out.append(
            MemberRead(
                id=m.id,
                user_id=m.user_id,
                server_id=m.server_id,
                nickname=m.nickname,
                username=user.username if user else "unknown",
                display_name=user.display_name if user else None,
                avatar_url=user.avatar_url if user else None,
                status=user.status if user else "online",
                status_message=user.status_message if user else None,
                role_ids=role_ids,
            )
        )
    return out


@router.get("/{server_id}/my-permissions")
async def get_my_permissions(
    server_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return the computed permission bitmask for the current user on this server."""
    result = await session.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Server not found")

    result = await session.execute(
        select(ServerMember).where(
            ServerMember.server_id == server.id,
            ServerMember.user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not a member of this server")

    # @everyone role
    result = await session.execute(
        select(Role).where(Role.server_id == server.id, Role.is_default == True)  # noqa: E712
    )
    everyone_role = result.scalar_one_or_none()
    everyone_perms = everyone_role.permissions if everyone_role else DEFAULT_EVERYONE_PERMISSIONS

    # Member's assigned role permissions
    result = await session.execute(
        select(Role.permissions)
        .join(MemberRole, MemberRole.role_id == Role.id)
        .where(MemberRole.member_id == member.id)
    )
    member_role_perms = [row[0] for row in result.all()]

    effective = compute_permissions(
        server_owner_id=server.owner_id,
        user_id=current_user.id,
        everyone_permissions=everyone_perms,
        member_role_permissions=member_role_perms,
    )

    return {"permissions": effective}
