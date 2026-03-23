import { useState, useCallback } from "react";
import * as api from "../services/api";
import type { NotificationFilter } from "../components/NotificationInbox";

export function useNotifications(inboxEnabled: boolean) {
  const [notifications, setNotifications] = useState<api.NotificationRead[]>([]);
  const [summary, setSummary] = useState<api.NotificationSummaryRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const refresh = useCallback(async () => {
    if (!inboxEnabled) {
      setSummary(null);
      setNotifications([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const [nextSummary, items] = await Promise.all([
        api.getNotificationSummary(),
        api.listNotifications(),
      ]);
      setSummary(nextSummary);
      setNotifications(items);
      setError(null);
    } catch (err: any) {
      console.warn("[Proteus] Failed to load inbox:", err);
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [inboxEnabled]);

  return {
    notifications,
    summary,
    setSummary,
    loading,
    error,
    filter,
    setFilter,
    refresh,
  };
}
