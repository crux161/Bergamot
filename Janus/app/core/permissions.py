"""Permission flags and authorization utilities for role-based access control."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from enum import IntFlag

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.user import User


class Permission(IntFlag):
    """Bitfield permission flags — mirrors Discord's practical subset."""

    ADMINISTRATOR = 0x1
    MANAGE_CHANNELS = 0x2
    MANAGE_ROLES = 0x4
    MANAGE_MESSAGES = 0x8
    MANAGE_SERVER = 0x10
    KICK_MEMBERS = 0x20
    SEND_MESSAGES = 0x40
    VIEW_CHANNELS = 0x80

    @classmethod
    def all(cls) -> int:
        """Return a bitmask with every permission flag set."""
        result = 0
        for p in cls:
            result |= p
        return result


# Default permissions for the auto-created @everyone role.
DEFAULT_EVERYONE_PERMISSIONS = int(Permission.SEND_MESSAGES | Permission.VIEW_CHANNELS)


@dataclass
class PermissionContext:
    """Resolved context returned by the RequirePermission dependency."""

    user: User
    server: "Server"  # type: ignore[name-defined]
    member: "ServerMember"  # type: ignore[name-defined]
    permissions: int


def compute_permissions(
    *,
    server_owner_id: uuid.UUID,
    user_id: uuid.UUID,
    everyone_permissions: int,
    member_role_permissions: list[int],
) -> int:
    """Compute the effective permissions for a user on a server.

    Args:
        server_owner_id: The UUID of the server owner.
        user_id: The UUID of the user being checked.
        everyone_permissions: The permission int of the @everyone role.
        member_role_permissions: Permission ints from each role assigned to this member.

    Returns:
        Combined permission bitmask.
    """
    # Server owner always has full permissions.
    if user_id == server_owner_id:
        return Permission.all()

    # Start with @everyone permissions, then OR in each assigned role.
    perms = everyone_permissions
    for rp in member_role_permissions:
        perms |= rp

    # If ADMINISTRATOR is granted, give everything.
    if perms & Permission.ADMINISTRATOR:
        return Permission.all()

    return perms


class RequirePermission:
    """Class-based FastAPI dependency that checks role permissions.

    Usage in a route::

        @router.post("/")
        async def create_channel(
            ...,
            ctx: PermissionContext = Depends(RequirePermission(Permission.MANAGE_CHANNELS)),
        ):
            ...

    The dependency resolves the server either from a ``server_id`` path param
    or by looking up the server via ``channel_id``.
    """

    def __init__(self, *perms: Permission):
        self.required = 0
        for p in perms:
            self.required |= int(p)

    async def __call__(
        self,
        server_id: str | None = None,
        channel_id: str | None = None,
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> PermissionContext:
        # Late imports to avoid circular dependencies at module level.
        from app.models.channel import Channel
        from app.models.member_role import MemberRole
        from app.models.role import Role
        from app.models.server import Server
        from app.models.server_member import ServerMember

        # --- Resolve the server ---
        if server_id is not None:
            result = await session.execute(select(Server).where(Server.id == server_id))
            server = result.scalar_one_or_none()
        elif channel_id is not None:
            result = await session.execute(select(Channel).where(Channel.id == channel_id))
            channel = result.scalar_one_or_none()
            if channel is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Channel not found")
            result = await session.execute(select(Server).where(Server.id == channel.server_id))
            server = result.scalar_one_or_none()
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot resolve server context")

        if server is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Server not found")

        # --- Resolve the member ---
        result = await session.execute(
            select(ServerMember).where(
                ServerMember.server_id == server.id,
                ServerMember.user_id == current_user.id,
            )
        )
        member = result.scalar_one_or_none()
        if member is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not a member of this server")

        # --- Load the @everyone role ---
        result = await session.execute(
            select(Role).where(Role.server_id == server.id, Role.is_default == True)  # noqa: E712
        )
        everyone_role = result.scalar_one_or_none()
        everyone_perms = everyone_role.permissions if everyone_role else DEFAULT_EVERYONE_PERMISSIONS

        # --- Load the member's assigned role permissions ---
        result = await session.execute(
            select(Role.permissions)
            .join(MemberRole, MemberRole.role_id == Role.id)
            .where(MemberRole.member_id == member.id)
        )
        member_role_perms = [row[0] for row in result.all()]

        # --- Compute effective permissions ---
        effective = compute_permissions(
            server_owner_id=server.owner_id,
            user_id=current_user.id,
            everyone_permissions=everyone_perms,
            member_role_permissions=member_role_perms,
        )

        if self.required and not (effective & self.required):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )

        return PermissionContext(
            user=current_user,
            server=server,
            member=member,
            permissions=effective,
        )
