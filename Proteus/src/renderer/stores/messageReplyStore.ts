import { createStore } from "./createStore";
import type { MessagePayload } from "../services/socket";

interface ReplyState {
  /** Channel/conversation ID → message being replied to */
  replyingTo: Record<string, MessagePayload | null>;
  /** Temporarily highlighted message ID (for scroll-to-reply) */
  highlightedMessageId: string | null;
}

const store = createStore<ReplyState>({
  replyingTo: {},
  highlightedMessageId: null,
});

export const messageReplyStore = {
  getSnapshot: store.getSnapshot,
  subscribe: store.subscribe,

  /** Start replying to a message in a given channel. */
  startReply(channelId: string, message: MessagePayload) {
    store.setState((prev) => ({
      ...prev,
      replyingTo: { ...prev.replyingTo, [channelId]: message },
    }));
  },

  /** Cancel the reply for a channel. */
  cancelReply(channelId: string) {
    store.setState((prev) => ({
      ...prev,
      replyingTo: { ...prev.replyingTo, [channelId]: null },
    }));
  },

  /** Get the message being replied to in a channel. */
  getReplyingTo(channelId: string): MessagePayload | null {
    return store.getSnapshot().replyingTo[channelId] ?? null;
  },

  /** Highlight a message briefly (for jumping to replied-to message). */
  highlightMessage(messageId: string) {
    store.setState((prev) => ({ ...prev, highlightedMessageId: messageId }));
    setTimeout(() => {
      store.setState((prev) => {
        if (prev.highlightedMessageId === messageId) {
          return { ...prev, highlightedMessageId: null };
        }
        return prev;
      });
    }, 2000);
  },
};
