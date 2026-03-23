import React, { useMemo } from "react";
import type { NotificationRead, NotificationSummaryRead } from "../services/api";
import { PhIcon } from "./PhIcon";
import styles from "./NotificationInbox.module.css";

export type NotificationFilter = "all" | "mentions" | "unread-dms";

interface Props {
  items: NotificationRead[];
  summary: NotificationSummaryRead | null;
  loading?: boolean;
  error?: string | null;
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  onSelect: (item: NotificationRead) => void;
  onMarkRead?: (item: NotificationRead) => void;
  onMarkAllRead?: () => void;
}

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveTitle(item: NotificationRead): string {
  if (item.notification_type === "dm_unread_summary") {
    return item.stream.peer_display_name || item.title;
  }
  return item.actor?.display_name || item.actor?.username || item.title;
}

function resolveSubtitle(item: NotificationRead): string {
  if (item.stream.stream_kind === "dm") {
    return item.stream.peer_display_name || "Direct Message";
  }
  if (item.stream.server_name && item.stream.channel_name) {
    return `${item.stream.server_name} · #${item.stream.channel_name}`;
  }
  return item.stream.channel_name || "Channel";
}

function resolveIcon(item: NotificationRead): string {
  switch (item.notification_type) {
    case "mention":
      return "at";
    case "reply":
      return "arrow-bend-up-left";
    case "dm_unread_summary":
      return "chat-circle-text";
    default:
      return "bell";
  }
}

export const NotificationInbox: React.FC<Props> = ({
  items,
  summary,
  loading = false,
  error = null,
  filter,
  onFilterChange,
  onSelect,
  onMarkRead,
  onMarkAllRead,
}) => {
  const filteredItems = useMemo(() => {
    if (filter === "mentions") {
      return items.filter((item) => item.notification_type === "mention");
    }
    if (filter === "unread-dms") {
      return items.filter((item) => item.notification_type === "dm_unread_summary");
    }
    return items;
  }, [filter, items]);

  const filterCounts = {
    all: items.length,
    mentions: items.filter((item) => item.notification_type === "mention").length,
    "unread-dms": items.filter((item) => item.notification_type === "dm_unread_summary").length,
  };

  const statItems = [
    { label: "Unread Total", value: String(summary?.total_unread ?? items.filter((item) => item.read_at == null).length) },
    { label: "Mentions", value: String(summary?.unread_mentions ?? filterCounts.mentions) },
    { label: "Unread DMs", value: String(summary?.unread_dm_messages ?? 0) },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Notifications</div>
          <div className={styles.title}>Stay ahead of the next reply</div>
          <div className={styles.description}>
            Mentions, replies, and unread DM summaries now come from Janus instead of local-only shell state.
          </div>
        </div>
        <div className={styles.stats}>
          {statItems.map((item) => (
            <div key={item.label} className={styles.statCard}>
              <div className={styles.statLabel}>{item.label}</div>
              <div className={styles.statValue}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {[
            { value: "all" as const, label: "All" },
            { value: "mentions" as const, label: "Mentions" },
            { value: "unread-dms" as const, label: "Unread DMs" },
          ].map((option) => (
            <button
              key={option.value}
              className={`${styles.filterButton} ${filter === option.value ? styles.filterButtonActive : ""}`}
              onClick={() => onFilterChange(option.value)}
            >
              <span>{option.label}</span>
              <span className={styles.filterCount}>{filterCounts[option.value]}</span>
            </button>
          ))}
        </div>
        {onMarkAllRead && (
          <button className={styles.actionButton} onClick={onMarkAllRead}>
            <PhIcon name="check" size={16} />
            <span>Mark Everything Read</span>
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>Loading inbox…</div>
        ) : filteredItems.length === 0 ? (
          <div className={styles.empty}>No items match this filter yet.</div>
        ) : (
          filteredItems.map((item) => {
            const unread = item.notification_type === "dm_unread_summary" || item.read_at == null;
            return (
              <div key={item.id} className={styles.item}>
                <button className={styles.itemMain} onClick={() => onSelect(item)}>
                  <div className={styles.itemIcon}>
                    <PhIcon name={resolveIcon(item)} size={18} />
                  </div>
                  <div className={styles.itemCopy}>
                    <div className={styles.itemRow}>
                      <span className={styles.itemTitle}>{resolveTitle(item)}</span>
                      <span className={styles.itemTime}>{formatTimeLabel(item.created_at)}</span>
                    </div>
                    <div className={styles.itemMeta}>{resolveSubtitle(item)}</div>
                    <div className={styles.itemBody}>{item.body || "Open to view the latest context."}</div>
                  </div>
                  <div className={styles.itemAside}>
                    {item.unread_count ? (
                      <span className={styles.unreadBadge}>{item.unread_count}</span>
                    ) : unread ? (
                      <span className={styles.unreadDot} />
                    ) : null}
                  </div>
                </button>
                {onMarkRead && item.notification_type !== "dm_unread_summary" && item.read_at == null && (
                  <button className={styles.markReadButton} onClick={() => onMarkRead(item)}>
                    Mark read
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
