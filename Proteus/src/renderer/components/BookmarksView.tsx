import React, { useEffect, useState, useCallback } from "react";
import type { SavedItemRead } from "../services/api";
import * as api from "../services/api";
import { PhIcon } from "./PhIcon";

interface Props {
  onNavigate: (routeHash: string) => void;
  onRemove?: (kind: "channel" | "dm", targetId: string) => void;
}

export const BookmarksView: React.FC<Props> = ({ onNavigate, onRemove }) => {
  const [items, setItems] = useState<SavedItemRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const saved = await api.listSavedItems();
      setItems(saved);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = useCallback(async (item: SavedItemRead) => {
    try {
      await api.unsaveItem(item.kind, item.target_id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (onRemove) onRemove(item.kind, item.target_id);
    } catch {
      // silently fail
    }
  }, [onRemove]);

  if (loading) {
    return (
      <div className="bookmarks-view">
        <div className="bookmarks-view__loading">Loading saved items...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bookmarks-view">
        <div className="bookmarks-view__error">
          <PhIcon name="warning" size={24} />
          <span>{error}</span>
          <button className="bookmarks-view__retry" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  const channelItems = items.filter((i) => i.kind === "channel");
  const dmItems = items.filter((i) => i.kind === "dm");
  const messageItems = items.filter((i) => i.kind === "message");

  if (items.length === 0) {
    return (
      <div className="bookmarks-view">
        <div className="bookmarks-view__empty">
          <PhIcon name="bookmark-simple" size={48} />
          <h3>No saved items yet</h3>
          <p>Star a channel or DM from the chat header to save it here for quick access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bookmarks-view">
      <div className="bookmarks-view__header">
        <span className="bookmarks-view__count">
          {items.length} saved item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {channelItems.length > 0 && (
        <div className="bookmarks-view__section">
          <h3 className="bookmarks-view__section-title">
            <PhIcon name="hash" size={16} />
            Saved Channels ({channelItems.length})
          </h3>
          <div className="bookmarks-view__list">
            {channelItems.map((item) => (
              <div key={item.id} className="bookmarks-view__item" onClick={() => onNavigate(item.route_hash)}>
                <div className="bookmarks-view__item-icon">
                  <PhIcon name={item.icon || "hash"} size={20} />
                </div>
                <div className="bookmarks-view__item-body">
                  <span className="bookmarks-view__item-label">{item.label}</span>
                  <span className="bookmarks-view__item-subtitle">{item.subtitle}</span>
                </div>
                <button
                  className="bookmarks-view__item-remove"
                  onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                  title="Remove bookmark"
                >
                  <PhIcon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {dmItems.length > 0 && (
        <div className="bookmarks-view__section">
          <h3 className="bookmarks-view__section-title">
            <PhIcon name="at" size={16} />
            Saved DMs ({dmItems.length})
          </h3>
          <div className="bookmarks-view__list">
            {dmItems.map((item) => (
              <div key={item.id} className="bookmarks-view__item" onClick={() => onNavigate(item.route_hash)}>
                <div className="bookmarks-view__item-icon">
                  <PhIcon name="at" size={20} />
                </div>
                <div className="bookmarks-view__item-body">
                  <span className="bookmarks-view__item-label">{item.label}</span>
                  <span className="bookmarks-view__item-subtitle">{item.subtitle}</span>
                </div>
                <button
                  className="bookmarks-view__item-remove"
                  onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                  title="Remove bookmark"
                >
                  <PhIcon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {messageItems.length > 0 && (
        <div className="bookmarks-view__section">
          <h3 className="bookmarks-view__section-title">
            <PhIcon name="bookmark-simple" size={16} />
            Saved Messages ({messageItems.length})
          </h3>
          <div className="bookmarks-view__list">
            {messageItems.map((item) => (
              <div key={item.id} className="bookmarks-view__item" onClick={() => onNavigate(item.route_hash)}>
                <div className="bookmarks-view__item-icon">
                  <PhIcon name={item.icon || "bookmark-simple"} size={20} />
                </div>
                <div className="bookmarks-view__item-body">
                  <span className="bookmarks-view__item-label">{item.label}</span>
                  <span className="bookmarks-view__item-subtitle">{item.subtitle}</span>
                </div>
                <button
                  className="bookmarks-view__item-remove"
                  onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                  title="Remove bookmark"
                >
                  <PhIcon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
