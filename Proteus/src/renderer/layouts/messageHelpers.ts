/**
 * Pure helper functions for converting between API/socket types
 * and the shapes AppLayout works with internally.
 */
import type { DmConversation } from "../components/ChannelList";
import type * as api from "../services/api";
import type { MessagePayload } from "../services/socket";
import { parseRoute } from "../stores/routerStore";
import type { FavoriteEntry } from "../stores/favoritesStore";

export function toDmConversation(dm: api.DMConversationRead): DmConversation {
  return {
    id: dm.id,
    userId: dm.peer_id,
    username: dm.peer_username,
    displayName: dm.peer_display_name || dm.peer_username,
    avatarUrl: dm.peer_avatar_url,
    status: (dm.peer_status as DmConversation["status"]) || "offline",
    lastMessage: dm.last_message || undefined,
    unreadCount: dm.unread_count || 0,
  };
}

export function toMessagePayload(message: api.MessageRead): MessagePayload {
  return {
    id: String(message.id),
    content: message.content,
    sender_id: String(message.sender_id),
    channel_id: String(message.channel_id),
    timestamp: message.created_at,
    nonce: message.nonce || undefined,
    attachments: message.attachments || undefined,
    reply_to_id: message.reply_to_id ? String(message.reply_to_id) : undefined,
    reply_to: message.reply_to || undefined,
    edited_at: message.edited_at || undefined,
    pinned: message.pinned,
    pinned_at: message.pinned_at || undefined,
    pinned_by: message.pinned_by ? String(message.pinned_by) : undefined,
    reaction_counts: message.reaction_counts,
  };
}

export function sortMessagesChronologically(items: MessagePayload[]): MessagePayload[] {
  return [...items].sort((left, right) => {
    const timeDelta = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    if (timeDelta !== 0) return timeDelta;
    return left.id.localeCompare(right.id);
  });
}

export function toFavoriteEntry(item: api.SavedItemRead): FavoriteEntry {
  return {
    id: item.id,
    kind: item.kind,
    label: item.label,
    subtitle: item.subtitle,
    routeHash: item.route_hash,
    icon: item.icon,
    createdAt: item.created_at,
  };
}

export function toSavedItemMutation(entry: FavoriteEntry): { kind: "channel" | "dm"; targetId: string; expectedId: string } | null {
  const target = parseRoute(entry.routeHash);
  if (entry.kind === "channel" && target.kind === "channel") {
    return {
      kind: "channel",
      targetId: target.channelId,
      expectedId: entry.id,
    };
  }
  if (entry.kind === "dm" && target.kind === "dmConversation") {
    return {
      kind: "dm",
      targetId: target.conversationId,
      expectedId: entry.id,
    };
  }
  return null;
}
