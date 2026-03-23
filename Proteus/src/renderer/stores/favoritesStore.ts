import { createStore, type ReadableStore } from "./createStore";

export interface FavoriteEntry {
  id: string;
  kind: "channel" | "dm";
  label: string;
  subtitle: string;
  routeHash: string;
  icon: string;
  createdAt: string;
}

const STORAGE_KEY = "proteus_favorite_entries";

function loadFavorites(): FavoriteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistFavorites(entries: FavoriteEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

type FavoritesSnapshot = {
  entries: FavoriteEntry[];
};

const internalStore = createStore<FavoritesSnapshot>({
  entries: loadFavorites(),
});

function updateEntries(updater: (entries: FavoriteEntry[]) => FavoriteEntry[]) {
  internalStore.setState((prev) => {
    const entries = updater(prev.entries);
    persistFavorites(entries);
    return { ...prev, entries };
  });
}

export const favoritesStore: ReadableStore<FavoritesSnapshot> & {
  getEntries: () => FavoriteEntry[];
  setEntries: (entries: FavoriteEntry[]) => void;
  toggleChannel: (guildId: string, channelId: string, label: string, subtitle: string) => void;
  toggleDm: (conversationId: string, label: string, subtitle: string) => void;
  isChannelFavorited: (guildId: string, channelId: string) => boolean;
  isDmFavorited: (conversationId: string) => boolean;
} = {
  getSnapshot: internalStore.getSnapshot,
  subscribe: internalStore.subscribe,
  getEntries: () => internalStore.getSnapshot().entries,
  setEntries: (entries) =>
    internalStore.setState((prev) => {
      persistFavorites(entries);
      return { ...prev, entries };
    }),
  toggleChannel: (guildId, channelId, label, subtitle) => {
    const id = `channel:${guildId}:${channelId}`;
    updateEntries((entries) => {
      if (entries.some((entry) => entry.id === id)) {
        return entries.filter((entry) => entry.id !== id);
      }
      return [
        {
          id,
          kind: "channel",
          label,
          subtitle,
          icon: "hash",
          routeHash: `#/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(channelId)}`,
          createdAt: new Date().toISOString(),
        },
        ...entries,
      ];
    });
  },
  toggleDm: (conversationId, label, subtitle) => {
    const id = `dm:${conversationId}`;
    updateEntries((entries) => {
      if (entries.some((entry) => entry.id === id)) {
        return entries.filter((entry) => entry.id !== id);
      }
      return [
        {
          id,
          kind: "dm",
          label,
          subtitle,
          icon: "at",
          routeHash: `#/channels/@me/${encodeURIComponent(conversationId)}`,
          createdAt: new Date().toISOString(),
        },
        ...entries,
      ];
    });
  },
  isChannelFavorited: (guildId, channelId) =>
    internalStore.getSnapshot().entries.some((entry) => entry.id === `channel:${guildId}:${channelId}`),
  isDmFavorited: (conversationId) =>
    internalStore.getSnapshot().entries.some((entry) => entry.id === `dm:${conversationId}`),
};
