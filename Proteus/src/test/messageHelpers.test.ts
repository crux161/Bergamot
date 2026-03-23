import { describe, it, expect } from "vitest";
import { sortMessagesChronologically, toMessagePayload } from "../renderer/layouts/messageHelpers";

describe("sortMessagesChronologically", () => {
  it("sorts messages by timestamp ascending", () => {
    const messages = [
      { id: "2", content: "second", sender_id: "a", channel_id: "c", timestamp: "2025-06-14T10:00:00Z" },
      { id: "1", content: "first", sender_id: "a", channel_id: "c", timestamp: "2025-06-14T09:00:00Z" },
      { id: "3", content: "third", sender_id: "a", channel_id: "c", timestamp: "2025-06-14T11:00:00Z" },
    ];
    const sorted = sortMessagesChronologically(messages);
    expect(sorted.map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("uses id as tiebreaker for same timestamp", () => {
    const messages = [
      { id: "b", content: "beta", sender_id: "a", channel_id: "c", timestamp: "2025-06-14T10:00:00Z" },
      { id: "a", content: "alpha", sender_id: "a", channel_id: "c", timestamp: "2025-06-14T10:00:00Z" },
    ];
    const sorted = sortMessagesChronologically(messages);
    expect(sorted.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the original array", () => {
    const messages = [
      { id: "2", content: "second", sender_id: "a", channel_id: "c", timestamp: "2025-06-14T10:00:00Z" },
      { id: "1", content: "first", sender_id: "a", channel_id: "c", timestamp: "2025-06-14T09:00:00Z" },
    ];
    const original = [...messages];
    sortMessagesChronologically(messages);
    expect(messages).toEqual(original);
  });
});

describe("toMessagePayload", () => {
  it("converts an API MessageRead to a MessagePayload", () => {
    const apiMessage = {
      id: 42,
      content: "hello world",
      sender_id: 7,
      channel_id: 101,
      created_at: "2025-06-14T09:15:00Z",
      nonce: "abc123",
      attachments: [],
      reply_to_id: null,
      reply_to: undefined,
      edited_at: null,
      pinned: false,
      pinned_at: null,
      pinned_by: null,
      reaction_counts: undefined,
    } as any;

    const payload = toMessagePayload(apiMessage);
    expect(payload.id).toBe("42");
    expect(payload.sender_id).toBe("7");
    expect(payload.channel_id).toBe("101");
    expect(payload.content).toBe("hello world");
    expect(payload.timestamp).toBe("2025-06-14T09:15:00Z");
    expect(payload.nonce).toBe("abc123");
    expect(payload.pinned).toBe(false);
  });

  it("converts reply_to_id to string when present", () => {
    const apiMessage = {
      id: 1,
      content: "reply",
      sender_id: 2,
      channel_id: 3,
      created_at: "2025-01-01T00:00:00Z",
      nonce: null,
      attachments: null,
      reply_to_id: 99,
      reply_to: undefined,
      edited_at: null,
      pinned: false,
      pinned_at: null,
      pinned_by: null,
      reaction_counts: undefined,
    } as any;

    const payload = toMessagePayload(apiMessage);
    expect(payload.reply_to_id).toBe("99");
  });
});
