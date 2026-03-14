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

export type MessagePayload = {
  id: string;
  content: string;
  sender_id: string;
  channel_id: string;
  timestamp: string;
  nonce?: string;
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

  socket.onError(() => console.error("[Hermes] Socket error"));
  socket.onClose(() => console.log("[Hermes] Socket closed"));

  socket.connect();
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
  nonce?: string
): Promise<MessagePayload> {
  const ch = activeChannels.get(channelId);
  if (!ch) throw new Error(`Not joined to channel ${channelId}`);

  return new Promise((resolve, reject) => {
    ch.push("new_message", { content, nonce })
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
