#!/usr/bin/env python3
"""Replay canonical Bergamot activity events from Janus state.

Publishes historical message lifecycle and read-state events back into
`bergamot.activity` so derived systems such as Heimdall and Mnemosyne can be
seeded from Janus truth.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid

from sqlalchemy import select

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JANUS_ROOT = os.path.dirname(SCRIPT_DIR)
if JANUS_ROOT not in sys.path:
    sys.path.insert(0, JANUS_ROOT)

from app.core.database import async_session_factory
from app.core.realtime_bridge import emit_message_domain_event, emit_read_state_domain_event
from app.models.channel import Channel
from app.models.dm_conversation import DMConversation
from app.models.message import Message
from app.models.read_state import ReadState
from app.models.user import User


async def _load_user(session, cache: dict[uuid.UUID, User], user_id: uuid.UUID) -> User | None:
    cached = cache.get(user_id)
    if cached is not None:
        return cached
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is not None:
        cache[user_id] = user
    return user


async def _load_channel(
    session,
    cache: dict[uuid.UUID, Channel | None],
    channel_id: uuid.UUID,
) -> Channel | None:
    if channel_id in cache:
        return cache[channel_id]
    result = await session.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    cache[channel_id] = channel
    return channel


async def _load_conversation(
    session,
    cache: dict[uuid.UUID, DMConversation | None],
    conversation_id: uuid.UUID,
) -> DMConversation | None:
    if conversation_id in cache:
        return cache[conversation_id]
    result = await session.execute(select(DMConversation).where(DMConversation.id == conversation_id))
    conversation = result.scalar_one_or_none()
    cache[conversation_id] = conversation
    return conversation


async def replay_messages(batch_size: int) -> int:
    published = 0
    offset = 0
    user_cache: dict[uuid.UUID, User] = {}
    channel_cache: dict[uuid.UUID, Channel | None] = {}
    conversation_cache: dict[uuid.UUID, DMConversation | None] = {}

    async with async_session_factory() as session:
        while True:
            result = await session.execute(
                select(Message)
                .order_by(Message.created_at.asc(), Message.id.asc())
                .offset(offset)
                .limit(batch_size)
            )
            messages = list(result.scalars().all())
            if not messages:
                break

            for message in messages:
                sender = await _load_user(session, user_cache, message.sender_id)
                if sender is None:
                    continue

                channel = await _load_channel(session, channel_cache, message.channel_id)
                if channel is not None:
                    await emit_message_domain_event(
                        session,
                        event_type="message_created",
                        message=message,
                        sender=sender,
                        actor=sender,
                        stream_kind="channel",
                        stream_id=channel.id,
                        channel=channel,
                    )
                else:
                    conversation = await _load_conversation(
                        session,
                        conversation_cache,
                        message.channel_id,
                    )
                    if conversation is None:
                        continue
                    await emit_message_domain_event(
                        session,
                        event_type="message_created",
                        message=message,
                        sender=sender,
                        actor=sender,
                        stream_kind="dm",
                        stream_id=conversation.id,
                        conversation=conversation,
                    )
                published += 1

            offset += len(messages)

    return published


async def replay_read_states(batch_size: int) -> int:
    published = 0
    offset = 0

    async with async_session_factory() as session:
        while True:
            result = await session.execute(
                select(ReadState)
                .order_by(ReadState.updated_at.asc(), ReadState.id.asc())
                .offset(offset)
                .limit(batch_size)
            )
            states = list(result.scalars().all())
            if not states:
                break

            for state in states:
                await emit_read_state_domain_event(
                    user_id=state.user_id,
                    target_kind=state.target_kind.value,
                    target_id=state.target_id,
                    last_read_message_id=state.last_read_message_id,
                    last_read_at=state.last_read_at,
                    updated_at=state.updated_at,
                )
                published += 1

            offset += len(states)

    return published


async def async_main(args: argparse.Namespace) -> None:
    total_messages = 0
    total_read_states = 0

    if not args.read_states_only:
        total_messages = await replay_messages(batch_size=args.batch_size)
        print(f"Published {total_messages} historical message events")

    if not args.messages_only:
        total_read_states = await replay_read_states(batch_size=args.batch_size)
        print(f"Published {total_read_states} historical read-state events")

    print(
        "Replay complete:",
        {
            "messages": total_messages,
            "read_states": total_read_states,
        },
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay Janus activity into bergamot.activity")
    parser.add_argument("--batch-size", type=int, default=200, help="Rows to publish per batch")
    parser.add_argument(
        "--messages-only",
        action="store_true",
        help="Replay message events but skip read states",
    )
    parser.add_argument(
        "--read-states-only",
        action="store_true",
        help="Replay read-state events but skip messages",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.messages_only and arguments.read_states_only:
        raise SystemExit("Choose only one of --messages-only or --read-states-only")
    asyncio.run(async_main(arguments))
