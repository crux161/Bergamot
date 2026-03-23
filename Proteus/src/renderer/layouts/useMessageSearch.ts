import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../services/api";

interface UseMessageSearchOptions {
  enabled: boolean;
  getDefaultScope: () => "channel" | "server" | "dm" | "global";
  getTargetId: (scope: "channel" | "server" | "dm" | "global") => string | null;
}

export function useMessageSearch({ enabled, getDefaultScope, getTargetId }: UseMessageSearchOptions) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"channel" | "server" | "dm" | "global">("global");
  const [results, setResults] = useState<api.MessageSearchResultRead[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<api.SearchFilters>({});
  const requestId = useRef(0);

  const openSearch = useCallback(() => {
    if (!enabled) return;
    setScope(getDefaultScope());
    setOpen(true);
  }, [enabled, getDefaultScope]);

  useEffect(() => {
    if (!open) return;
    setScope(getDefaultScope());
    setQuery("");
    setError(null);
    setLoading(false);
    setResults([]);
    setNextCursor(null);
    setFilters({});
  }, [getDefaultScope, open]);

  useEffect(() => {
    if (!open || !enabled) return;

    const q = query.trim();
    const targetId = getTargetId(scope);
    if (!q) {
      setResults([]);
      setNextCursor(null);
      setLoading(false);
      setError(null);
      return;
    }
    if ((scope === "channel" || scope === "server" || scope === "dm") && !targetId) {
      setResults([]);
      setNextCursor(null);
      setLoading(false);
      setError("That search scope is not available from this route.");
      return;
    }

    const rid = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api.searchMessages(q, scope, targetId, null, filters)
        .then((page) => {
          if (requestId.current !== rid) return;
          setResults(page.items);
          setNextCursor(page.next_cursor);
          setError(null);
        })
        .catch((err: any) => {
          if (requestId.current !== rid) return;
          setResults([]);
          setNextCursor(null);
          setError(err.message || "Search failed");
        })
        .finally(() => {
          if (requestId.current === rid) setLoading(false);
        });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [enabled, filters, getTargetId, open, query, scope]);

  const loadMore = useCallback(async () => {
    const q = query.trim();
    const targetId = getTargetId(scope);
    if (!q || !nextCursor) return;
    try {
      setLoading(true);
      const page = await api.searchMessages(q, scope, targetId, nextCursor, filters);
      setResults((prev) => [...prev, ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (err: any) {
      setError(err.message || "Failed to load more results");
    } finally {
      setLoading(false);
    }
  }, [filters, getTargetId, nextCursor, query, scope]);

  return {
    open,
    setOpen,
    query,
    setQuery,
    scope,
    setScope,
    results,
    nextCursor,
    loading,
    error,
    openSearch,
    loadMore,
    filters,
    setFilters,
  };
}
