import React, { useEffect, useState, useCallback } from "react";
import type { MentionRead, StreamContextRead, MessageRead } from "../services/api";
import * as api from "../services/api";
import { PhIcon } from "./PhIcon";

interface Props {
  onNavigate: (stream: StreamContextRead, message: MessageRead) => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString();
}

export const MentionsView: React.FC<Props> = ({ onNavigate }) => {
  const [mentions, setMentions] = useState<MentionRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.listMentions();
      setMentions(items);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load mentions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="mentions-view">
        <div className="mentions-view__loading">Loading mentions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mentions-view">
        <div className="mentions-view__error">
          <PhIcon name="warning" size={24} />
          <span>{error}</span>
          <button className="mentions-view__retry" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  if (mentions.length === 0) {
    return (
      <div className="mentions-view">
        <div className="mentions-view__empty">
          <PhIcon name="at" size={48} />
          <h3>No recent mentions</h3>
          <p>When someone @mentions you in any channel or DM, it will appear here.</p>
        </div>
      </div>
    );
  }

  const unreadCount = mentions.filter((m) => !m.read_at).length;

  return (
    <div className="mentions-view">
      <div className="mentions-view__header">
        <span className="mentions-view__count">
          {mentions.length} mention{mentions.length !== 1 ? "s" : ""}
          {unreadCount > 0 && <span className="mentions-view__unread-badge">{unreadCount} unread</span>}
        </span>
      </div>
      <div className="mentions-view__list">
        {mentions.map((mention) => {
          const streamLabel = mention.stream.stream_kind === "dm"
            ? mention.stream.peer_display_name || "Direct Message"
            : mention.stream.channel_name
              ? `#${mention.stream.channel_name}`
              : "Channel";
          const serverLabel = mention.stream.server_name || null;

          return (
            <div
              key={mention.id}
              className={`mentions-view__item ${!mention.read_at ? "mentions-view__item--unread" : ""}`}
              onClick={() => onNavigate(mention.stream, mention.message)}
            >
              <div className="mentions-view__item-avatar">
                {mention.actor?.avatar_url ? (
                  <img src={mention.actor.avatar_url} alt="" className="mentions-view__avatar-img" />
                ) : (
                  <div className="mentions-view__avatar-fallback">
                    {(mention.actor?.display_name || mention.actor?.username || "?")[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="mentions-view__item-body">
                <div className="mentions-view__item-header">
                  <span className="mentions-view__item-author">
                    {mention.actor?.display_name || mention.actor?.username || "Unknown"}
                  </span>
                  <span className="mentions-view__item-context">
                    {serverLabel && <span className="mentions-view__server-name">{serverLabel}</span>}
                    <span className="mentions-view__channel-name">{streamLabel}</span>
                  </span>
                  <span className="mentions-view__item-time">{formatTimestamp(mention.message.created_at)}</span>
                </div>
                <div className="mentions-view__item-content">
                  {mention.message.content}
                </div>
              </div>
              {!mention.read_at && <div className="mentions-view__unread-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
