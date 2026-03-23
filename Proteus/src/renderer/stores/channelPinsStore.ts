import { createStore } from "./createStore";
import type { MessageRead } from "../services/api";

interface PinsState {
  /** channel_id → pinned messages */
  pins: Record<string, MessageRead[]>;
  /** channel_id → loading state */
  loading: Record<string, boolean>;
  /** Whether the pins panel is open */
  panelOpen: boolean;
}

const store = createStore<PinsState>({
  pins: {},
  loading: {},
  panelOpen: false,
});

export const channelPinsStore = {
  getSnapshot: store.getSnapshot,
  subscribe: store.subscribe,

  /** Set pinned messages for a channel (from API response). */
  setPins(channelId: string, messages: MessageRead[]) {
    store.setState((prev) => ({
      ...prev,
      pins: { ...prev.pins, [channelId]: messages },
      loading: { ...prev.loading, [channelId]: false },
    }));
  },

  /** Mark loading for a channel. */
  setLoading(channelId: string, loading: boolean) {
    store.setState((prev) => ({
      ...prev,
      loading: { ...prev.loading, [channelId]: loading },
    }));
  },

  /** Get pinned messages for a channel. */
  getPins(channelId: string): MessageRead[] {
    return store.getSnapshot().pins[channelId] ?? [];
  },

  /** Handle a message being pinned (real-time). */
  handlePin(channelId: string, messageId: string, pinnedBy: string, pinnedAt: string) {
    store.setState((prev) => {
      const existing = prev.pins[channelId] ?? [];
      // Update if already in the list (shouldn't happen, but be safe)
      const idx = existing.findIndex((m) => m.id === messageId);
      if (idx >= 0) return prev;
      // We don't have the full message data from the socket event alone,
      // so just mark that pins need refresh
      return { ...prev, loading: { ...prev.loading, [channelId]: true } };
    });
  },

  /** Handle a message being unpinned (real-time). */
  handleUnpin(channelId: string, messageId: string) {
    store.setState((prev) => {
      const existing = prev.pins[channelId] ?? [];
      return {
        ...prev,
        pins: { ...prev.pins, [channelId]: existing.filter((m) => m.id !== messageId) },
      };
    });
  },

  /** Toggle pins panel visibility. */
  togglePanel() {
    store.setState((prev) => ({ ...prev, panelOpen: !prev.panelOpen }));
  },

  /** Close pins panel. */
  closePanel() {
    store.setState((prev) => ({ ...prev, panelOpen: false }));
  },

  isPanelOpen(): boolean {
    return store.getSnapshot().panelOpen;
  },
};
