"use client";

import { useState, useCallback, useEffect } from "react";
import type { ActivityLog } from "./ActivityFeed";

export function useActivityLogs(
  initialLogs: ActivityLog[],
  groupId: string,
  initialHasMore: boolean
) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // When router.refresh() delivers fresh server data, replace any pending items.
  useEffect(() => {
    setLogs((prev) => {
      if (!prev.some((l) => l.isPending)) return prev;
      return initialLogs;
    });
  }, [initialLogs]);

  const addOptimisticLog = useCallback((log: ActivityLog) => {
    setLogs((prev) => [log, ...prev]);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    // Use the oldest non-pending log's createdAt as the cursor.
    const nonPendingLogs = logs.filter((l) => !l.isPending);
    const lastLog = nonPendingLogs[nonPendingLogs.length - 1];
    if (!lastLog) return;

    const createdAt =
      typeof lastLog.createdAt === "string"
        ? lastLog.createdAt
        : lastLog.createdAt.toISOString();

    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/activity?before=${encodeURIComponent(createdAt)}&limit=20`
      );
      if (!res.ok) return;
      const { data } = (await res.json()) as {
        data: { logs: ActivityLog[]; hasMore: boolean };
      };
      setLogs((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const newLogs = data.logs.filter((l) => !existingIds.has(l.id));
        return [...prev, ...newLogs];
      });
      setHasMore(data.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  }, [groupId, logs, isLoadingMore, hasMore]);

  return { logs, addOptimisticLog, hasMore, isLoadingMore, loadMore };
}
