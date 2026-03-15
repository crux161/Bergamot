/**
 * WebSocket client for Hermes (Real-Time Gateway).
 * Uses the Phoenix JS client to connect to Phoenix Channels.
 */

import { Socket, Channel } from "phoenix";
import { getToken } from "./api";

const HERMES_URL =
  (window as any).__BERGAMOT_WS_URL__ || "ws://localhost:4000/socket";

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
};

export type MessageHandler = (msg: MessagePayload) => void;
export type TypingHandler = (payload: { user_id: string }) => void;

/** Connect to Hermes. Call after login. */
export function connect() {
  const token = getToken();
  if (!token) throw new Error("Cannot connect without auth token");

  socket = new Socket(HERMES_URL, {
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

/** Join a channel room and subscribe to events. */
export function joinChannel(
  channelId: string,
  onMessage: MessageHandler,
  onTyping?: TypingHandler
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
  attachments?: AttachmentPayload[]
): Promise<MessagePayload> {
  const ch = activeChannels.get(channelId);
  if (!ch) throw new Error(`Not joined to channel ${channelId}`);

  return new Promise((resolve, reject) => {
    ch.push("new_message", { content, nonce, attachments })
      .receive("ok", (msg: MessagePayload) => resolve(msg))
      .receive("error", (err) => reject(new Error(JSON.stringify(err))))
      .receive("timeout", () => reject(new Error("Message send timed out")));
  });
}

export function sendTyping(channelId: string) {
  const ch = activeChannels.get(channelId);
  if (ch) {
    ch.push("typing", {});
  }
}
