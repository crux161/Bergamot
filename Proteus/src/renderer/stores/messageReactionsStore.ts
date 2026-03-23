import { createStore } from "./createStore";
import type { ReactionCount } from "../services/api";

interface ReactionsState {
  /** message_id → aggregated reaction counts */
  reactions: Record<string, ReactionCount[]>;
}

const store = createStore<ReactionsState>({
  reactions: {},
});

export const messageReactionsStore = {
  getSnapshot: store.getSnapshot,
  subscribe: store.subscribe,

  /** Bulk-set reactions for a list of messages (e.g. on initial load). */
  setFromMessages(messages: Array<{ id: string; reaction_counts?: ReactionCount[] }>) {
    store.setState((prev) => {
      const next = { ...prev.reactions };
      for (const msg of messages) {
        if (msg.reaction_counts && msg.reaction_counts.length > 0) {
          next[msg.id] = msg.reaction_counts;
        }
      }
      return { reactions: next };
    });
  },

  /** Get reactions for a specific message. */
  getReactions(messageId: string): ReactionCount[] {
    return store.getSnapshot().reactions[messageId] ?? [];
  },

  /** Handle a reaction_add event from the socket. */
  handleReactionAdd(messageId: string, emoji: string, isMe: boolean) {
    store.setState((prev) => {
      const existing = prev.reactions[messageId] ?? [];
      const idx = existing.findIndex((r) => r.emoji === emoji);
      let updated: ReactionCount[];
      if (idx >= 0) {
        updated = existing.map((r, i) =>
          i === idx ? { ...r, count: r.count + 1, me: r.me || isMe } : r
        );
      } else {
        updated = [...existing, { emoji, count: 1, me: isMe }];
      }
      return { reactions: { ...prev.reactions, [messageId]: updated } };
    });
  },

  /** Handle a reaction_remove event from the socket. */
  handleReactionRemove(messageId: string, emoji: string, isMe: boolean) {
    store.setState((prev) => {
      const existing = prev.reactions[messageId] ?? [];
      const idx = existing.findIndex((r) => r.emoji === emoji);
      if (idx < 0) return prev;

      const reaction = existing[idx];
      if (reaction.count <= 1) {
        // Remove the emoji entirely
        const updated = existing.filter((_, i) => i !== idx);
        return { reactions: { ...prev.reactions, [messageId]: updated } };
      }
      const updated = existing.map((r, i) =>
        i === idx ? { ...r, count: r.count - 1, me: isMe ? false : r.me } : r
      );
      return { reactions: { ...prev.reactions, [messageId]: updated } };
    });
  },

  /** Clear reactions for a channel (when leaving). */
  clearForChannel(messageIds: string[]) {
    store.setState((prev) => {
      const next = { ...prev.reactions };
      for (const id of messageIds) {
        delete next[id];
      }
      return { reactions: next };
    });
  },
};
