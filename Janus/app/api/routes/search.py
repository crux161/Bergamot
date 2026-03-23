"""Search routes for message history."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from datetime import datetime
from urllib import error, request

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Text, cast, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.message_activity import build_search_snippet
from app.core.message_views import build_message_read
from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.enums import StreamKind
from app.models.message import Message
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.schemas.activity import MessageSearchResultRead, SearchResultsPageRead, StreamContextRead

router = APIRouter(prefix="/search", tags=["search"])
logger = logging.getLogger(__name__)


def _encode_cursor(message: Message) -> str:
    payload = f"{message.created_at.isoformat()}::{message.id}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")


def _decode_cursor(cursor: str) -> datetime:
    raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
    created_at, _message_id = raw.split("::", 1)
    return datetime.fromisoformat(created_at)


def _encode_offset_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(str(offset).encode("utf-8")).decode("utf-8")


def _decode_offset_cursor(cursor: str) -> int:
    raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
    return max(int(raw), 0)


async def _build_stream_context(
    session: AsyncSession,
    *,
    current_user: User,
    message: Message,
) -> StreamContextRead:
    channel_result = await session.execute(select(Channel).where(Channel.id == message.channel_id))
    channel = channel_result.scalar_one_or_none()
    if channel is not None:
        server_result = await session.execute(select(Server).where(Server.id == channel.server_id))
        server = server_result.scalar_one_or_none()
        return StreamContextRead(
            stream_kind=StreamKind.CHANNEL,
            stream_id=channel.id,
            server_id=server.id if server else None,
            server_name=server.name if server else None,
            channel_name=channel.name,
        )

    conv_result = await session.execute(select(DMConversation).where(DMConversation.id == message.channel_id))
    conversation = conv_result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message stream not found")

    peer_id = conversation.user_b_id if conversation.user_a_id == current_user.id else conversation.user_a_id
    peer_result = await session.execute(select(User).where(User.id == peer_id))
    peer = peer_result.scalar_one_or_none()
    return StreamContextRead(
        stream_kind=StreamKind.DM,
        stream_id=conversation.id,
        peer_display_name=(peer.display_name or peer.username) if peer else "Direct Message",
    )


async def _accessible_stream_ids(session: AsyncSession, *, current_user: User) -> tuple[set[uuid.UUID], set[uuid.UUID]]:
    channel_ids: set[uuid.UUID] = set()
    dm_ids: set[uuid.UUID] = set()

    member_rows = await session.execute(
        select(ServerMember.server_id).where(ServerMember.user_id == current_user.id)
    )
    member_server_ids = [row[0] for row in member_rows.all()]
    if member_server_ids:
        channel_rows = await session.execute(
            select(Channel.id).where(Channel.server_id.in_(member_server_ids))
        )
        channel_ids.update(row[0] for row in channel_rows.all())

    owner_rows = await session.execute(select(Server.id).where(Server.owner_id == current_user.id))
    owner_server_ids = [row[0] for row in owner_rows.all()]
    if owner_server_ids:
        owner_channel_rows = await session.execute(
            select(Channel.id).where(Channel.server_id.in_(owner_server_ids))
        )
        channel_ids.update(row[0] for row in owner_channel_rows.all())

    dm_rows = await session.execute(
        select(DMConversation.id).where(
            (DMConversation.user_a_id == current_user.id) | (DMConversation.user_b_id == current_user.id)
        )
    )
    dm_ids.update(row[0] for row in dm_rows.all())
    return channel_ids, dm_ids


def _build_meilisearch_filter(stream_ids: set[uuid.UUID]) -> str:
    return " OR ".join(
        f"streamId = {json.dumps(str(stream_id))}"
        for stream_id in sorted(stream_ids, key=str)
    )


def _meilisearch_request(path: str, payload: dict) -> dict:
    if not settings.MEILISEARCH_URL:
        raise RuntimeError("Meilisearch URL not configured")

    url = f"{settings.MEILISEARCH_URL.rstrip('/')}{path}"
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.MEILISEARCH_API_KEY:
        headers["Authorization"] = f"Bearer {settings.MEILISEARCH_API_KEY}"

    req = request.Request(url, data=body, method="POST", headers=headers)
    with request.urlopen(req, timeout=5) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


async def _build_search_results(
    session: AsyncSession,
    *,
    current_user: User,
    messages: list[Message],
    q: str,
    next_cursor: str | None,
) -> SearchResultsPageRead:
    items = []
    for message in messages:
        items.append(
            MessageSearchResultRead(
                id=str(message.id),
                cursor=_encode_cursor(message),
                snippet=build_search_snippet(
                    message.content or str(message.attachments or ""),
                    q,
                ),
                message=await build_message_read(message, current_user.id, session),
                stream=await _build_stream_context(session, current_user=current_user, message=message),
            )
        )

    return SearchResultsPageRead(items=items, next_cursor=next_cursor)


def _resolve_target_stream_ids(
    *,
    scope: str,
    target_id: uuid.UUID | None,
    channel_ids: set[uuid.UUID],
    dm_ids: set[uuid.UUID],
    server_channel_ids: list[uuid.UUID] | None = None,
) -> set[uuid.UUID]:
    if scope == "channel":
        if target_id is None or target_id not in channel_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
        return {target_id}

    if scope == "server":
        if target_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Server target required")
        scoped_ids = set(server_channel_ids or [])
        if not scoped_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
        return scoped_ids

    if scope == "dm":
        if target_id is None or target_id not in dm_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return {target_id}

    return channel_ids | dm_ids


async def _search_messages_via_meilisearch(
    session: AsyncSession,
    *,
    q: str,
    stream_ids: set[uuid.UUID],
    cursor: str | None,
    limit: int,
    current_user: User,
) -> SearchResultsPageRead | None:
    if not settings.MEILISEARCH_ENABLED or not settings.MEILISEARCH_URL or not stream_ids:
        return None

    try:
        offset = _decode_offset_cursor(cursor) if cursor is not None else 0
        response = await asyncio.to_thread(
            _meilisearch_request,
            f"/indexes/{settings.MEILISEARCH_INDEX}/search",
            {
                "q": q,
                "limit": limit + 1,
                "offset": offset,
                "filter": _build_meilisearch_filter(stream_ids),
            },
        )
    except (RuntimeError, ValueError, error.URLError, TimeoutError, OSError) as exc:
        logger.warning("Falling back to Postgres search because Meilisearch is unavailable: %s", exc)
        return None

    hits = response.get("hits", [])
    if not hits:
        return SearchResultsPageRead(items=[], next_cursor=None)

    hit_ids: list[uuid.UUID] = []
    for hit in hits:
        raw_id = hit.get("id")
        if not raw_id:
            continue
        try:
            hit_ids.append(uuid.UUID(str(raw_id)))
        except ValueError:
            continue

    if not hit_ids:
        return SearchResultsPageRead(items=[], next_cursor=None)

    result = await session.execute(
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(Message.id.in_(hit_ids))
    )
    message_map = {message.id: message for message in result.scalars().unique().all()}
    ordered_messages = [message_map[message_id] for message_id in hit_ids if message_id in message_map]

    if not ordered_messages:
        return SearchResultsPageRead(items=[], next_cursor=None)

    next_cursor = None
    if len(hits) > limit:
        next_cursor = _encode_offset_cursor(offset + limit)
        ordered_messages = ordered_messages[:limit]

    return await _build_search_results(
        session,
        current_user=current_user,
        messages=ordered_messages,
        q=q,
        next_cursor=next_cursor,
    )


async def _search_messages_via_postgres(
    session: AsyncSession,
    *,
    q: str,
    stream_ids: set[uuid.UUID],
    cursor: str | None,
    limit: int,
    current_user: User,
    author_id: uuid.UUID | None = None,
    has_attachment: bool | None = None,
    before: datetime | None = None,
    after: datetime | None = None,
) -> SearchResultsPageRead:
    if not stream_ids:
        return SearchResultsPageRead(items=[], next_cursor=None)

    search_clause = or_(
        Message.content.ilike(f"%{q}%"),
        cast(Message.attachments, Text).ilike(f"%{q}%"),
    )

    statement = (
        select(Message)
        .options(joinedload(Message.reply_to))
        .where(
            search_clause,
            Message.channel_id.in_(list(stream_ids)),
        )
    )

    if author_id is not None:
        statement = statement.where(Message.user_id == author_id)
    if has_attachment is True:
        statement = statement.where(cast(Message.attachments, Text) != "null", cast(Message.attachments, Text) != "[]")
    if before is not None:
        statement = statement.where(Message.created_at < before)
    if after is not None:
        statement = statement.where(Message.created_at > after)

    if cursor is not None:
        try:
            statement = statement.where(Message.created_at < _decode_cursor(cursor))
        except Exception:
            logger.warning("Ignoring incompatible Postgres search cursor during fallback")

    statement = statement.order_by(desc(Message.created_at)).limit(limit + 1)
    result = await session.execute(statement)
    messages = list(result.scalars().unique().all())

    next_cursor = None
    if len(messages) > limit:
        next_cursor = _encode_cursor(messages[limit - 1])
        messages = messages[:limit]

    return await _build_search_results(
        session,
        current_user=current_user,
        messages=messages,
        q=q,
        next_cursor=next_cursor,
    )


@router.get("/messages", response_model=SearchResultsPageRead)
async def search_messages(
    q: str = Query(min_length=1, max_length=200),
    scope: str = Query(default="global", pattern="^(channel|server|dm|global)$"),
    target_id: uuid.UUID | None = Query(default=None),
    author_id: uuid.UUID | None = Query(default=None),
    has_attachment: bool | None = Query(default=None),
    before: datetime | None = Query(default=None),
    after: datetime | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Search persisted messages across accessible streams."""
    channel_ids, dm_ids = await _accessible_stream_ids(session, current_user=current_user)
    server_channel_ids: list[uuid.UUID] | None = None
    if scope == "server":
        if target_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Server target required")
        server_channel_rows = await session.execute(
            select(Channel.id).where(Channel.server_id == target_id)
        )
        server_channel_ids = [row[0] for row in server_channel_rows.all() if row[0] in channel_ids]

    stream_ids = _resolve_target_stream_ids(
        scope=scope,
        target_id=target_id,
        channel_ids=channel_ids,
        dm_ids=dm_ids,
        server_channel_ids=server_channel_ids,
    )
    if not stream_ids:
        return SearchResultsPageRead(items=[], next_cursor=None)

    projection_results = await _search_messages_via_meilisearch(
        session,
        q=q,
        stream_ids=stream_ids,
        cursor=cursor,
        limit=limit,
        current_user=current_user,
    )
    if projection_results is not None and (projection_results.items or cursor is not None):
        return projection_results

    return await _search_messages_via_postgres(
        session,
        q=q,
        stream_ids=stream_ids,
        cursor=cursor,
        limit=limit,
        current_user=current_user,
        author_id=author_id,
        has_attachment=has_attachment,
        before=before,
        after=after,
    )
