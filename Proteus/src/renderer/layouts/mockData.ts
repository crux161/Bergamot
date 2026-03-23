/**
 * Mock/fallback data used when the live Janus API is unreachable.
 * Extracted from AppLayout to keep the main layout component focused
 * on orchestration rather than carrying inline seed data.
 */
import type * as api from "../services/api";
import type { MessagePayload } from "../services/socket";

export const MOCK_SERVERS: api.ServerRead[] = [
  { id: "1", name: "Mount Olympus", icon_url: null, owner_id: "0", created_at: "2025-01-01T00:00:00Z" },
  { id: "2", name: "Jade Palace", icon_url: null, owner_id: "0", created_at: "2025-01-02T00:00:00Z" },
];

export const MOCK_CHANNELS: Record<string, api.ChannelRead[]> = {
  "1": [
    { id: "101", name: "general", topic: "Welcome to Mount Olympus", channel_type: "text", position: 0, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
    { id: "102", name: "announcements", topic: "Important updates", channel_type: "text", position: 1, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
    { id: "103", name: "off-topic", topic: null, channel_type: "text", position: 2, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
    { id: "104", name: "voice-lounge", topic: null, channel_type: "voice", position: 3, server_id: "1", created_at: "2025-01-01T00:00:00Z" },
  ],
  "2": [
    { id: "201", name: "general", topic: "The Jade Palace awaits", channel_type: "text", position: 0, server_id: "2", created_at: "2025-01-02T00:00:00Z" },
    { id: "202", name: "training", topic: "Sharpen your skills", channel_type: "text", position: 1, server_id: "2", created_at: "2025-01-02T00:00:00Z" },
  ],
};

export const MOCK_MESSAGES: MessagePayload[] = [
  { id: "m1", content: "Has anyone seen the new gateway config?", sender_id: "u-artemis", channel_id: "101", timestamp: "2025-06-14T09:15:00Z" },
  { id: "m2", content: "Yeah, Hermes pushed an update last night. Channels are routing properly now.", sender_id: "u-hephaestus", channel_id: "101", timestamp: "2025-06-14T09:17:00Z" },
  { id: "m3", content: "Nice. I was getting timeout errors on the voice channels earlier.", sender_id: "u-athena", channel_id: "101", timestamp: "2025-06-14T09:20:00Z" },
  { id: "m4", content: "That should be resolved. Let me know if it happens again.", sender_id: "u-hephaestus", channel_id: "101", timestamp: "2025-06-14T09:21:00Z" },
  { id: "m5", content: "Quick question — are we still using Janus for auth or did that change?", sender_id: "u-apollo", channel_id: "101", timestamp: "2025-06-14T10:02:00Z" },
  { id: "m6", content: "Still Janus. The token flow goes through /api/v1/auth/login.", sender_id: "u-artemis", channel_id: "101", timestamp: "2025-06-14T10:05:00Z" },
  { id: "m7", content: "Perfect, thanks. Proteus frontend is almost wired up.", sender_id: "u-apollo", channel_id: "101", timestamp: "2025-06-14T10:06:00Z" },
  { id: "m8", content: "Here's the new architecture diagram:", sender_id: "u-athena", channel_id: "101", timestamp: "2025-06-14T10:10:00Z", attachments: [{ id: "att-1", filename: "architecture.png", content_type: "image/png", url: "https://placehold.co/400x300/2b2d31/6b9362?text=Architecture+Diagram" }] },
];

export const MOCK_MEMBERS = [
  { id: "0", username: "Eain", display_name: "Eain", status: "online" as const },
  { id: "u-artemis", username: "Artemis", display_name: "Artemis", status: "online" as const },
  { id: "u-hephaestus", username: "Hephaestus", display_name: "Hephaestus", status: "idle" as const },
  { id: "u-athena", username: "Athena", display_name: "Athena", status: "online" as const },
  { id: "u-apollo", username: "Apollo", display_name: "Apollo", status: "dnd" as const },
  { id: "u-hermes", username: "Hermes", display_name: "Hermes", status: "offline" as const },
];
