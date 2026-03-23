import { useState, useCallback, useRef } from "react";
import * as api from "../services/api";
import { favoritesStore, type FavoriteEntry } from "../stores/favoritesStore";
import { toFavoriteEntry, toSavedItemMutation } from "./messageHelpers";

export function useSavedItems(currentUserId: string, savedItemsEnabled: boolean) {
  const [available, setAvailable] = useState(false);
  const initialLocalFavorites = useRef<FavoriteEntry[]>(favoritesStore.getEntries());

  const refresh = useCallback(async (migrateLocal = false) => {
    if (!savedItemsEnabled) {
      setAvailable(false);
      return false;
    }

    try {
      let items = await api.listSavedItems();
      if (migrateLocal && typeof window !== "undefined") {
        const migrationKey = `proteus_saved_items_migrated:${currentUserId}:${api.getConfiguredServerUrl()}`;
        const migrationDone = window.localStorage.getItem(migrationKey) === "true";
        if (!migrationDone) {
          const localItems = initialLocalFavorites.current
            .map(toSavedItemMutation)
            .filter((item): item is { kind: "channel" | "dm"; targetId: string; expectedId: string } => item !== null)
            .filter((item) => !items.some((saved) => saved.id === item.expectedId));

          if (localItems.length > 0) {
            await Promise.all(localItems.map((item) => api.saveItem(item.kind, item.targetId).catch(() => null)));
            items = await api.listSavedItems();
          }
          window.localStorage.setItem(migrationKey, "true");
        }
      }

      favoritesStore.setEntries(items.map(toFavoriteEntry));
      setAvailable(true);
      return true;
    } catch (err) {
      console.warn("[Proteus] Failed to sync saved items:", err);
      setAvailable(false);
      return false;
    }
  }, [currentUserId, savedItemsEnabled]);

  return { available, refresh };
}
