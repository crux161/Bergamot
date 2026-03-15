"""Role CRUD routes: create, list, update, delete roles and manage role assignments."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.permissions import Permission, PermissionContext, RequirePermission
from app.models.member_role import MemberRole
from app.models.role import Role
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.role import RoleCreate, RoleRead, RoleUpdate

router = APIRouter(prefix="/servers/{server_id}/roles", tags=["roles"])


@router.get("/", response_model=list[RoleRead])
async def list_roles(
    server_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all roles for a server, ordered by position descending."""
    result = await session.execute(
        select(Role).where(Role.server_id == server_id).order_by(Role.position.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role(
    server_id: str,
    body: RoleCreate,
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_ROLES)),
    session: AsyncSession = Depends(get_session),
):
    """Create a new role in the server."""
    # Determine next position (above @everyone, below existing roles)
    result = await session.execute(
        select(Role).where(Role.server_id == server_id).order_by(Role.position.desc())
    )
    existing = result.scalars().all()
    next_position = (existing[0].position + 1) if existing else 1

    role = Role(
        name=body.name,
        color=body.color,
        permissions=body.permissions,
        position=next_position,
        is_default=False,
        server_id=ctx.server.id,
    )
    session.add(role)
    await session.commit()
    await session.refresh(role)
    return role


@router.patch("/{role_id}", response_model=RoleRead)
async def update_role(
    server_id: str,
    role_id: str,
    body: RoleUpdate,
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_ROLES)),
    session: AsyncSession = Depends(get_session),
):
    """Update a role's name, color, permissions, or position."""
    result = await session.execute(
        select(Role).where(Role.id == role_id, Role.server_id == server_id)
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Role not found")

    # Cannot rename @everyone
    if role.is_default and body.name is not None and body.name != role.name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot rename the @everyone role")

    if body.name is not None:
        role.name = body.name
    if body.color is not None:
        role.color = body.color
    if body.permissions is not None:
        role.permissions = body.permissions
    if body.position is not None:
        role.position = body.position

    await session.commit()
    await session.refresh(role)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    server_id: str,
    role_id: str,
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_ROLES)),
    session: AsyncSession = Depends(get_session),
):
    """Delete a role. The @everyone role cannot be deleted."""
    result = await session.execute(
        select(Role).where(Role.id == role_id, Role.server_id == server_id)
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_default:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot delete the @everyone role")

    await session.delete(role)
    await session.commit()


@router.put("/{role_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def assign_role(
    server_id: str,
    role_id: str,
    member_id: str,
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_ROLES)),
    session: AsyncSession = Depends(get_session),
):
    """Assign a role to a server member."""
    # Verify role exists in this server
    result = await session.execute(
        select(Role).where(Role.id == role_id, Role.server_id == server_id)
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_default:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot assign the @everyone role")

    # Verify member exists
    result = await session.execute(
        select(ServerMember).where(ServerMember.id == member_id, ServerMember.server_id == server_id)
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Check for existing assignment
    result = await session.execute(
        select(MemberRole).where(MemberRole.member_id == member_id, MemberRole.role_id == role_id)
    )
    if result.scalar_one_or_none() is not None:
        return  # Already assigned, idempotent

    mr = MemberRole(member_id=member.id, role_id=role.id)
    session.add(mr)
    await session.commit()


@router.delete("/{role_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role(
    server_id: str,
    role_id: str,
    member_id: str,
    ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_ROLES)),
    session: AsyncSession = Depends(get_session),
):
    """Remove a role from a server member."""
    result = await session.execute(
        select(MemberRole).where(MemberRole.member_id == member_id, MemberRole.role_id == role_id)
    )
    mr = result.scalar_one_or_none()
    if mr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Role assignment not found")

    await session.delete(mr)
    await session.commit()
