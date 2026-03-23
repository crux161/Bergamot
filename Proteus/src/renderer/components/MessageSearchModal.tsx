import React, { useState, useCallback } from "react";
import type { MessageSearchResultRead, SearchFilters } from "../services/api";
import { PhIcon } from "./PhIcon";
import styles from "./MessageSearchModal.module.css";

export type MessageSearchScope = "channel" | "server" | "dm" | "global";

export interface MessageSearchScopeOption {
  value: MessageSearchScope;
  label: string;
}

interface Props {
  open: boolean;
  query: string;
  scope: MessageSearchScope;
  scopeOptions: MessageSearchScopeOption[];
  results: MessageSearchResultRead[];
  loading?: boolean;
  error?: string | null;
  nextCursor?: string | null;
  targetLabel?: string | null;
  filters?: SearchFilters;
  userMap?: Record<string, string>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onScopeChange: (scope: MessageSearchScope) => void;
  onSelectResult: (result: MessageSearchResultRead) => void;
  onLoadMore?: () => void;
  onFiltersChange?: (filters: SearchFilters) => void;
}

function formatResultMeta(result: MessageSearchResultRead): string {
  if (result.stream.stream_kind === "dm") {
    return result.stream.peer_display_name || "Direct Message";
  }
  const parts = [result.stream.server_name, result.stream.channel_name ? `#${result.stream.channel_name}` : null].filter(Boolean);
  return parts.join(" · ");
}

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveAuthorName(
  senderId: string,
  userMap?: Record<string, string>,
): string {
  if (!userMap) return senderId;
  return userMap[senderId] || senderId;
}

function highlightSnippet(snippet: string, query: string): React.ReactNode {
  if (!query.trim()) return snippet;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = snippet.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className={styles.highlight}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export const MessageSearchModal: React.FC<Props> = ({
  open,
  query,
  scope,
  scopeOptions,
  results,
  loading = false,
  error = null,
  nextCursor = null,
  targetLabel = null,
  filters = {},
  userMap,
  onClose,
  onQueryChange,
  onScopeChange,
  onSelectResult,
  onLoadMore,
  onFiltersChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = useCallback(
    (key: keyof SearchFilters, value: string | boolean | undefined) => {
      if (!onFiltersChange) return;
      const next = { ...filters };
      if (value === undefined || value === "" || value === false) {
        delete next[key];
      } else {
        (next as any)[key] = value;
      }
      onFiltersChange(next);
    },
    [filters, onFiltersChange],
  );

  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== "" && v !== false).length;

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Message Search</div>
            <div className={styles.title}>Find the exact thread you need</div>
            <div className={styles.subtitle}>
              {targetLabel ? `Searching from ${targetLabel}` : "Search across your Bergamot history"}
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <PhIcon name="x" size={18} />
          </button>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchRow}>
            <PhIcon name="magnifying-glass" size={18} className={styles.searchIcon} />
            <input
              autoFocus
              className={styles.searchInput}
              placeholder="Search messages, attachment names, and replies"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {onFiltersChange && (
              <button
                className={`${styles.filterToggle} ${activeFilterCount > 0 ? styles.filterToggleActive : ""}`}
                onClick={() => setShowFilters((prev) => !prev)}
                title="Advanced filters"
              >
                <PhIcon name="funnel" size={16} />
                {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
              </button>
            )}
          </div>

          {showFilters && onFiltersChange && (
            <div className={styles.filtersPanel}>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>From user</label>
                <input
                  className={styles.filterInput}
                  placeholder="User ID or leave empty"
                  value={filters.authorId || ""}
                  onChange={(e) => updateFilter("authorId", e.target.value || undefined)}
                />
              </div>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>After</label>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={filters.after ? filters.after.split("T")[0] : ""}
                  onChange={(e) =>
                    updateFilter("after", e.target.value ? `${e.target.value}T00:00:00Z` : undefined)
                  }
                />
              </div>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>Before</label>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={filters.before ? filters.before.split("T")[0] : ""}
                  onChange={(e) =>
                    updateFilter("before", e.target.value ? `${e.target.value}T23:59:59Z` : undefined)
                  }
                />
              </div>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>
                  <input
                    type="checkbox"
                    checked={!!filters.hasAttachment}
                    onChange={(e) => updateFilter("hasAttachment", e.target.checked || undefined)}
                  />{" "}
                  Has attachment
                </label>
              </div>
            </div>
          )}

          <div className={styles.scopeRow}>
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                className={`${styles.scopeButton} ${scope === option.value ? styles.scopeButtonActive : ""}`}
                onClick={() => onScopeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.results}>
          {!query.trim() ? (
            <div className={styles.empty}>Start typing to search your recent history.</div>
          ) : loading && results.length === 0 ? (
            <div className={styles.empty}>Searching…</div>
          ) : results.length === 0 ? (
            <div className={styles.empty}>No messages matched that search.</div>
          ) : (
            <>
              <div className={styles.resultCount}>
                {results.length} result{results.length !== 1 ? "s" : ""}
                {nextCursor ? "+" : ""}
              </div>
              {results.map((result) => (
                <button
                  key={`${result.id}-${result.cursor}`}
                  className={styles.result}
                  onClick={() => onSelectResult(result)}
                >
                  <div className={styles.resultHeader}>
                    <span className={styles.resultMeta}>{formatResultMeta(result)}</span>
                    <span className={styles.resultTime}>{formatTimeLabel(result.message.created_at)}</span>
                  </div>
                  <div className={styles.resultBody}>{highlightSnippet(result.snippet, query)}</div>
                  <div className={styles.resultFooter}>
                    <span className={styles.resultAuthor}>{resolveAuthorName(result.message.sender_id, userMap)}</span>
                    <span className={styles.resultJump}>
                      Jump to message
                      <PhIcon name="arrow-right" size={14} />
                    </span>
                  </div>
                </button>
              ))}
              {nextCursor && onLoadMore && (
                <button className={styles.loadMoreButton} onClick={onLoadMore}>
                  {loading ? "Loading…" : "Load More Results"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
