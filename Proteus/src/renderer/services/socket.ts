/**
 * WebSocket client for Hermes (Real-Time Gateway).
 * Uses the Phoenix JS client to connect to Phoenix Channels.
 */

import { Socket, Channel } from "phoenix";
import { buildHermesSocketUrl } from "@bergamot/config";
import { getToken, getConfiguredServerUrl } from "./api";

/** Derive the Hermes WebSocket URL from the configured server address.
 *  Default Hermes runs on port 4000 of the same host as the API. */
function getHermesUrl(): string {
  const override = (window as any).__BERGAMOT_WS_URL__;
  if (override) return override;

  try {
    return buildHermesSocketUrl(getConfiguredServerUrl());
  } catch {
    return "ws://localhost:4000/socket";
  }
}

let socket: Socket | null = null;
const activeChannels = new Map<string, Channel>();

export type AttachmentPayload = {
  id: string;
  filename: string;
  content_type: string;
  url: string;
};

export type MessagePayload = {
  id: string;
  content: string;
  sender_id: string;
  channel_id: string;
  timestamp: string;
  nonce?: string;
  attachments?: AttachmentPayload[];
  reply_to_id?: string;
  reply_to?: { id: string; sender_id: string; content: string; created_at: string } | null;
  edited_at?: string;
  pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
  reaction_counts?: Array<{ emoji: string; count: number; me: boolean }>;
};

export type ReactionEvent = {
  message_id: string;
  emoji: string;
  user_id: string;
};

export type MessageEditedEvent = {
  message_id: string;
  content: string;
  edited_at: string;
  editor_id: string;
};

export type MessageDeletedEvent = {
  message_id: string;
  channel_id: string;
  deleted_by: string;
};

export type MessagePinnedEvent = {
  message_id: string;
  channel_id: string;
  pinned_by: string;
  pinned_at: string;
};

export type MessageUnpinnedEvent = {
  message_id: string;
  channel_id: string;
};

export type NotificationCreatedEvent = {
  notification_type: "mention" | "reply" | "dm_unread_summary";
  message_id?: string | null;
  stream_kind?: "channel" | "dm";
  stream_id?: string;
  reason?: string;
};

export type NotificationReadEvent = {
  notification_id?: string | null;
  read_all?: boolean;
};

export type UnreadCountUpdatedEvent = {
  summary?: {
    total_unread: number;
    unread_notifications: number;
    unread_mentions: number;
    unread_replies: number;
    unread_dm_conversations: number;
    unread_dm_messages: number;
  };
  reason?: string;
  target_kind?: "channel" | "dm";
  target_id?: string;
};

export type SavedItemUpdatedEvent = {
  kind: "channel" | "dm";
  target_id: string;
  action: "saved" | "removed";
};

export type RelationshipPresenceUpdatedEvent = {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  status_message?: string | null;
};

export type MessageHandler = (msg: MessagePayload) => void;
export type TypingHandler = (payload: { user_id: string; username: string }) => void;
export type ReactionHandler = (event: ReactionEvent) => void;
export type MessageEditedHandler = (event: MessageEditedEvent) => void;
export type MessageDeletedHandler = (event: MessageDeletedEvent) => void;
export type MessagePinnedHandler = (event: MessagePinnedEvent) => void;
export type MessageUnpinnedHandler = (event: MessageUnpinnedEvent) => void;
export type NotificationCreatedHandler = (event: NotificationCreatedEvent) => void;
export type NotificationReadHandler = (event: NotificationReadEvent) => void;
export type UnreadCountUpdatedHandler = (event: UnreadCountUpdatedEvent) => void;
export type SavedItemUpdatedHandler = (event: SavedItemUpdatedEvent) => void;
export type RelationshipPresenceUpdatedHandler = (event: RelationshipPresenceUpdatedEvent) => void;

/** Connect to Hermes. Call after login. */
export function connect() {
  const token = getToken();
  if (!token) throw new Error("Cannot connect without auth token");

  socket = new Socket(getHermesUrl(), {
    params: { token },
    heartbeatIntervalMs: 30000,
  });

  socket.connect();
}

/** Register lifecycle callbacks on the underlying socket. */
export function onOpen(cb: () => void) { socket?.onOpen(cb); }
export function onError(cb: (err: any) => void) { socket?.onError(cb); }
export function onClose(cb: (event: any) => void) { socket?.onClose(cb); }

/** Check if we have an active channel for the given ID. */
export function isJoined(channelId: string): boolean {
  return activeChannels.has(channelId);
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeChannels.clear();
}

function getRealtimeChannel(identifier: string): Channel | undefined {
  return activeChannels.get(identifier) || activeChannels.get(`dm:${identifier}`);
}

export interface ChannelEventHandlers {
  onMessage: MessageHandler;
  onTyping?: TypingHandler;
  onReactionAdd?: ReactionHandler;
  onReactionRemove?: ReactionHandler;
  onMessageEdited?: MessageEditedHandler;
  onMessageDeleted?: MessageDeletedHandler;
  onMessagePinned?: MessagePinnedHandler;
  onMessageUnpinned?: MessageUnpinnedHandler;
}

export interface UserChannelHandlers {
  onNotificationCreated?: NotificationCreatedHandler;
  onNotificationRead?: NotificationReadHandler;
  onUnreadCountUpdated?: UnreadCountUpdatedHandler;
  onSavedItemUpdated?: SavedItemUpdatedHandler;
  onRelationshipPresenceUpdated?: RelationshipPresenceUpdatedHandler;
}

/** Join a channel room and subscribe to events. */
export function joinChannel(
  channelId: string,
  onMessage: MessageHandler,
  onTyping?: TypingHandler,
  handlers?: Partial<ChannelEventHandlers>,
): Channel {
  if (!socket) throw new Error("Socket not connected");

  // Leave previous if already joined
  leaveChannel(channelId);

  const channel = socket.channel(`channel:${channelId}`, {});

  channel.on("new_message", (msg: MessagePayload) => {
    onMessage(msg);
  });

  if (onTyping) {
    channel.on("typing", onTyping);
  }

  // Rich event handlers
  if (handlers?.onReactionAdd) {
    channel.on("reaction_add", handlers.onReactionAdd);
  }
  if (handlers?.onReactionRemove) {
    channel.on("reaction_remove", handlers.onReactionRemove);
  }
  if (handlers?.onMessageEdited) {
    channel.on("message_edited", handlers.onMessageEdited);
  }
  if (handlers?.onMessageDeleted) {
    channel.on("message_deleted", handlers.onMessageDeleted);
  }
  if (handlers?.onMessagePinned) {
    channel.on("message_pinned", handlers.onMessagePinned);
  }
  if (handlers?.onMessageUnpinned) {
    channel.on("message_unpinned", handlers.onMessageUnpinned);
  }

  channel
    .join()
    .receive("ok", (resp) => {
      console.log(`[Hermes] Joined channel:${channelId}`, resp);
    })
    .receive("error", (resp) => {
      console.error(`[Hermes] Failed to join channel:${channelId}`, resp);
    });

  activeChannels.set(channelId, channel);
  return channel;
}

export function leaveChannel(channelId: string) {
  const ch = activeChannels.get(channelId);
  if (ch) {
    ch.leave();
    activeChannels.delete(channelId);
  }
}

/** Send a message to the current channel. */
export function sendMessage(
  channelId: string,
  content: string,
  nonce?: string,
  attachments?: AttachmentPayload[],
  replyToId?: string,
): Promise<MessagePayload> {
  const ch = activeChannels.get(channelId);
  if (!ch) throw new Error(`Not joined to channel ${channelId}`);

  return new Promise((resolve, reject) => {
    ch.push("new_message", { content, nonce, attachments, reply_to_id: replyToId })
      .receive("ok", (msg: MessagePayload) => resolve(msg))
      .receive("error", (err) => reject(new Error(JSON.stringify(err))))
      .receive("timeout", () => reject(new Error("Message send timed out")));
  });
}

export function sendTyping(channelId: string, username?: string) {
  const ch = activeChannels.get(channelId);
  if (ch) {
    ch.push("typing", { username: username || "Someone" });
  }
}

/** Broadcast a reaction add event on the channel. */
export function pushReactionAdd(channelId: string, messageId: string, emoji: string) {
  const ch = getRealtimeChannel(channelId);
  if (ch) {
    ch.push("reaction_add", { message_id: messageId, emoji });
  }
}

/** Broadcast a reaction remove event on the channel. */
export function pushReactionRemove(channelId: string, messageId: string, emoji: string) {
  const ch = getRealtimeChannel(channelId);
  if (ch) {
    ch.push("reaction_remove", { message_id: messageId, emoji });
  }
}

/** Broadcast a message edit event on the channel. */
export function pushMessageEdit(channelId: string, messageId: string, content: string) {
  const ch = getRealtimeChannel(channelId);
  if (ch) {
    ch.push("edit_message", { message_id: messageId, content });
  }
}

/** Broadcast a message delete event on the channel. */
export function pushMessageDelete(channelId: string, messageId: string) {
  const ch = getRealtimeChannel(channelId);
  if (ch) {
    ch.push("delete_message", { message_id: messageId });
  }
}

/** Broadcast a pin event on the channel. */
export function pushPinMessage(channelId: string, messageId: string) {
  const ch = getRealtimeChannel(channelId);
  if (ch) {
    ch.push("pin_message", { message_id: messageId });
  }
}

/** Broadcast an unpin event on the channel. */
export function pushUnpinMessage(channelId: string, messageId: string) {
  const ch = getRealtimeChannel(channelId);
  if (ch) {
    ch.push("unpin_message", { message_id: messageId });
  }
}

// ── DM channel helpers ──

/** Join a DM conversation channel (`dm:<conversationId>`) on the existing socket. */
export function joinDMChannel(
  conversationId: string,
  onMessage: MessageHandler,
  onTyping?: TypingHandler,
  handlers?: Partial<ChannelEventHandlers>,
): Channel {
  if (!socket) throw new Error("Socket not connected");

  const topic = `dm:${conversationId}`;

  // Leave if already joined
  const existing = activeChannels.get(topic);
  if (existing) {
    existing.leave();
    activeChannels.delete(topic);
  }

  const channel = socket.channel(topic, {});

  channel.on("new_message", (msg: MessagePayload) => {
    onMessage(msg);
  });

  if (onTyping) {
    channel.on("typing", onTyping);
  }

  if (handlers?.onReactionAdd) {
    channel.on("reaction_add", handlers.onReactionAdd);
  }
  if (handlers?.onReactionRemove) {
    channel.on("reaction_remove", handlers.onReactionRemove);
  }
  if (handlers?.onMessageEdited) {
    channel.on("message_edited", handlers.onMessageEdited);
  }
  if (handlers?.onMessageDeleted) {
    channel.on("message_deleted", handlers.onMessageDeleted);
  }
  if (handlers?.onMessagePinned) {
    channel.on("message_pinned", handlers.onMessagePinned);
  }
  if (handlers?.onMessageUnpinned) {
    channel.on("message_unpinned", handlers.onMessageUnpinned);
  }

  channel
    .join()
    .receive("ok", (resp) => {
      console.log(`[Hermes] Joined ${topic}`, resp);
    })
    .receive("error", (resp) => {
      console.error(`[Hermes] Failed to join ${topic}`, resp);
    });

  activeChannels.set(topic, channel);
  return channel;
}

/** Leave a DM conversation channel. */
export function leaveDMChannel(conversationId: string) {
  const topic = `dm:${conversationId}`;
  const ch = activeChannels.get(topic);
  if (ch) {
    ch.leave();
    activeChannels.delete(topic);
  }
}

/** Join the authenticated user's private realtime topic (`user:<userId>`). */
export function joinUserChannel(userId: string, handlers?: UserChannelHandlers): Channel {
  if (!socket) throw new Error("Socket not connected");

  const topic = `user:${userId}`;
  const existing = activeChannels.get(topic);
  if (existing) {
    existing.leave();
    activeChannels.delete(topic);
  }

  const channel = socket.channel(topic, {});

  if (handlers?.onNotificationCreated) {
    channel.on("notification_created", handlers.onNotificationCreated);
  }
  if (handlers?.onNotificationRead) {
    channel.on("notification_read", handlers.onNotificationRead);
  }
  if (handlers?.onUnreadCountUpdated) {
    channel.on("unread_count_updated", handlers.onUnreadCountUpdated);
  }
  if (handlers?.onSavedItemUpdated) {
    channel.on("saved_item_updated", handlers.onSavedItemUpdated);
  }
  if (handlers?.onRelationshipPresenceUpdated) {
    channel.on("relationship_presence_updated", handlers.onRelationshipPresenceUpdated);
  }

  channel
    .join()
    .receive("ok", (resp) => {
      console.log(`[Hermes] Joined ${topic}`, resp);
    })
    .receive("error", (resp) => {
      console.error(`[Hermes] Failed to join ${topic}`, resp);
    });

  activeChannels.set(topic, channel);
  return channel;
}

export function leaveUserChannel(userId: string) {
  const topic = `user:${userId}`;
  const channel = activeChannels.get(topic);
  if (channel) {
    channel.leave();
    activeChannels.delete(topic);
  }
}

/** Send a message to a DM conversation channel. */
export function sendDMMessage(
  conversationId: string,
  content: string,
  nonce?: string,
  attachments?: AttachmentPayload[],
  replyToId?: string,
): Promise<MessagePayload> {
  const topic = `dm:${conversationId}`;
  const ch = activeChannels.get(topic);
  if (!ch) throw new Error(`Not joined to DM ${conversationId}`);

  return new Promise((resolve, reject) => {
    ch.push("new_message", { content, nonce, attachments, reply_to_id: replyToId })
      .receive("ok", (msg: MessagePayload) => resolve(msg))
      .receive("error", (err) => reject(new Error(JSON.stringify(err))))
      .receive("timeout", () => reject(new Error("DM message send timed out")));
  });
}

/** Send a typing indicator in a DM conversation. */
export function sendDMTyping(conversationId: string, username?: string) {
  const topic = `dm:${conversationId}`;
  const ch = activeChannels.get(topic);
  if (ch) {
    ch.push("typing", { username: username || "Someone" });
  }
}

// ── Voice channel helpers ──

export type LiveKitTokenPayload = { token: string; url: string };
export type PresenceState = Record<string, { metas: Array<{ username: string; joined_at: number }> }>;

/**
 * Join a voice room channel (`voice:<roomId>`) on the existing socket.
 * Returns the Phoenix Channel instance so the caller can listen for events
 * and leave when done.
 */
export function joinVoiceChannel(
  roomId: string,
  username: string,
  onToken: (payload: LiveKitTokenPayload) => void,
  onPresenceState?: (state: PresenceState) => void,
  onPresenceDiff?: (diff: { joins: PresenceState; leaves: PresenceState }) => void,
): Channel {
  if (!socket) throw new Error("Socket not connected");

  const topic = `voice:${roomId}`;

  // Leave if already joined
  const existing = activeChannels.get(topic);
  if (existing) {
    existing.leave();
    activeChannels.delete(topic);
  }

  const channel = socket.channel(topic, { username });

  channel.on("livekit_token", (payload: LiveKitTokenPayload) => {
    onToken(payload);
  });

  if (onPresenceState) {
    channel.on("presence_state", onPresenceState);
  }

  if (onPresenceDiff) {
    channel.on("presence_diff", onPresenceDiff);
  }

  channel
    .join()
    .receive("ok", (resp) => {
      console.log(`[Hermes] Joined ${topic}`, resp);
    })
    .receive("error", (resp) => {
      console.error(`[Hermes] Failed to join ${topic}`, resp);
    });

  activeChannels.set(topic, channel);
  return channel;
}

/** Leave a voice room channel. */
export function leaveVoiceChannel(roomId: string) {
  const topic = `voice:${roomId}`;
  const ch = activeChannels.get(topic);
  if (ch) {
    ch.leave();
    activeChannels.delete(topic);
  }
}

/** Push a state event on the voice channel (mute, video, screen share). */
export function pushVoiceEvent(roomId: string, event: string, payload: Record<string, any>) {
  const topic = `voice:${roomId}`;
  const ch = activeChannels.get(topic);
  if (ch) {
    ch.push(event, payload);
  }
}
