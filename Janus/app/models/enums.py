"""Shared SQLAlchemy enums for messaging-core parity domains."""

from enum import Enum as PyEnum


class StreamKind(str, PyEnum):
    """Supported message stream kinds."""

    CHANNEL = "channel"
    DM = "dm"


class NotificationType(str, PyEnum):
    """Notification types surfaced to Proteus."""

    MENTION = "mention"
    REPLY = "reply"
    DM_UNREAD_SUMMARY = "dm_unread_summary"


class SavedItemKind(str, PyEnum):
    """Saved item kinds currently supported by the client."""

    CHANNEL = "channel"
    DM = "dm"
    MESSAGE = "message"

