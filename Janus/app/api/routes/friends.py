"""Friend / relationship management routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.friendship import Friendship
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.friendship import FriendNicknameUpdate, FriendRequestCreate, FriendshipRead, MutualServerRead

router = APIRouter(prefix="/friends", tags=["friends"])

# Relationship type constants
FRIEND = 1
BLOCKED = 2
INCOMING_REQUEST = 3
OUTGOING_REQUEST = 4


def _to_read(f: Friendship) -> FriendshipRead:
    peer = f.peer
    return FriendshipRead(
        id=f.id,
        peer_id=f.peer_id,
        relationship_type=f.relationship_type,
        nickname=f.nickname,
        created_at=f.created_at,
        peer_username=peer.username if peer else None,
        peer_display_name=peer.display_name if peer else None,
        peer_avatar_url=peer.avatar_url if peer else None,
        peer_banner_url=peer.banner_url if peer else None,
        peer_status=peer.status if peer else None,
        peer_status_message=peer.status_message if peer else None,
    )


async def _get_relationship(
    session: AsyncSession,
    user_id: str,
    peer_id: str,
) -> Friendship | None:
    result = await session.execute(
        select(Friendship).where(
            Friendship.user_id == user_id,
            Friendship.peer_id == peer_id,
        )
    )
    return result.scalar_one_or_none()


async def _block_peer(
    session: AsyncSession,
    current_user: User,
    target: User,
) -> Friendship:
    relationship = await _get_relationship(session, current_user.id, target.id)

    if relationship is None:
        relationship = Friendship(
            user_id=current_user.id,
            peer_id=target.id,
            relationship_type=BLOCKED,
        )
        session.add(relationship)
    else:
        relationship.relationship_type = BLOCKED
        relationship.nickname = None

    reverse_relationship = await _get_relationship(session, target.id, current_user.id)
    if reverse_relationship is not None:
        await session.delete(reverse_relationship)

    await session.commit()
    await session.refresh(relationship)
    return relationship


@router.get("/", response_model=list[FriendshipRead])
async def list_relationships(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all relationships (friends, pending requests, blocks) for the current user."""
    result = await session.execute(
        select(Friendship).where(Friendship.user_id == current_user.id)
    )
    return [_to_read(f) for f in result.scalars().all()]


@router.post("/request", response_model=FriendshipRead, status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    body: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Send a friend request by username."""
    result = await session.execute(select(User).where(User.username == body.username))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send a friend request to yourself")

    reverse_relationship = await _get_relationship(session, target.id, current_user.id)
    if reverse_relationship is not None and reverse_relationship.relationship_type == BLOCKED:
        raise HTTPException(status_code=400, detail="This user is not accepting requests")

    # Check for existing relationship
    rel = await _get_relationship(session, current_user.id, target.id)
    if rel is not None:
        if rel.relationship_type == FRIEND:
            raise HTTPException(status_code=409, detail="Already friends")
        if rel.relationship_type == OUTGOING_REQUEST:
            raise HTTPException(status_code=409, detail="Friend request already sent")
        if rel.relationship_type == BLOCKED:
            raise HTTPException(status_code=400, detail="Cannot send request to a blocked user")
        if rel.relationship_type == INCOMING_REQUEST:
            # They already sent us a request — auto-accept
            rel.relationship_type = FRIEND
            # Update their side too
            peer_rel = await session.execute(
                select(Friendship).where(
                    Friendship.user_id == target.id,
                    Friendship.peer_id == current_user.id,
                )
            )
            peer = peer_rel.scalar_one_or_none()
            if peer:
                peer.relationship_type = FRIEND
            await session.commit()
            await session.refresh(rel)
            return _to_read(rel)

    # Create outgoing request for current user
    outgoing = Friendship(
        user_id=current_user.id,
        peer_id=target.id,
        relationship_type=OUTGOING_REQUEST,
    )
    # Create incoming request for target user
    incoming = Friendship(
        user_id=target.id,
        peer_id=current_user.id,
        relationship_type=INCOMING_REQUEST,
    )
    session.add_all([outgoing, incoming])
    await session.commit()
    await session.refresh(outgoing)
    return _to_read(outgoing)


@router.post("/block", response_model=FriendshipRead, status_code=status.HTTP_201_CREATED)
async def block_user_by_username(
    body: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Block a user by username."""
    result = await session.execute(select(User).where(User.username == body.username))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")

    relationship = await _block_peer(session, current_user, target)
    return _to_read(relationship)


@router.put("/{user_id}/block", response_model=FriendshipRead)
async def block_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Block a user by id."""
    result = await session.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")

    relationship = await _block_peer(session, current_user, target)
    return _to_read(relationship)


@router.put("/{user_id}/accept", response_model=FriendshipRead)
async def accept_friend_request(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Accept an incoming friend request."""
    result = await session.execute(
        select(Friendship).where(
            Friendship.user_id == current_user.id,
            Friendship.peer_id == user_id,
            Friendship.relationship_type == INCOMING_REQUEST,
        )
    )
    rel = result.scalar_one_or_none()
    if rel is None:
        raise HTTPException(status_code=404, detail="No pending request from this user")

    rel.relationship_type = FRIEND

    # Update the other side
    peer_result = await session.execute(
        select(Friendship).where(
            Friendship.user_id == user_id,
            Friendship.peer_id == current_user.id,
        )
    )
    peer_rel = peer_result.scalar_one_or_none()
    if peer_rel:
        peer_rel.relationship_type = FRIEND

    await session.commit()
    await session.refresh(rel)
    return _to_read(rel)


@router.delete("/{user_id}")
async def remove_relationship(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a friendship, cancel a request, or unblock a user."""
    result = await session.execute(
        select(Friendship).where(
            Friendship.user_id == current_user.id,
            Friendship.peer_id == user_id,
        )
    )
    rel = result.scalar_one_or_none()
    if rel is None:
        raise HTTPException(status_code=404, detail="No relationship with this user")

    # Also remove the peer's side
    peer_result = await session.execute(
        select(Friendship).where(
            Friendship.user_id == user_id,
            Friendship.peer_id == current_user.id,
        )
    )
    peer_rel = peer_result.scalar_one_or_none()

    await session.delete(rel)
    if peer_rel:
        await session.delete(peer_rel)
    await session.commit()

    return {"ok": True}


@router.patch("/{user_id}/nickname", response_model=FriendshipRead)
async def update_nickname(
    user_id: str,
    body: FriendNicknameUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Set or clear a friend's nickname."""
    result = await session.execute(
        select(Friendship).where(
            Friendship.user_id == current_user.id,
            Friendship.peer_id == user_id,
            Friendship.relationship_type == FRIEND,
        )
    )
    rel = result.scalar_one_or_none()
    if rel is None:
        raise HTTPException(status_code=404, detail="Not friends with this user")

    rel.nickname = body.nickname
    await session.commit()
    await session.refresh(rel)
    return _to_read(rel)


@router.get("/{user_id}/mutual-servers", response_model=list[MutualServerRead])
async def get_mutual_servers(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return servers that both the current user and the target user are members of."""
    my_servers = await session.execute(
        select(ServerMember.server_id).where(ServerMember.user_id == current_user.id)
    )
    my_server_ids = {row[0] for row in my_servers.all()}

    peer_servers = await session.execute(
        select(ServerMember.server_id).where(ServerMember.user_id == user_id)
    )
    peer_server_ids = {row[0] for row in peer_servers.all()}

    mutual_ids = my_server_ids & peer_server_ids
    if not mutual_ids:
        return []

    from app.models.server import Server

    result = await session.execute(select(Server).where(Server.id.in_(mutual_ids)))
    return [
        MutualServerRead(id=s.id, name=s.name, icon_url=s.icon_url)
        for s in result.scalars().all()
    ]
