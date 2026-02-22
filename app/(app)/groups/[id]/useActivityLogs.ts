"use client";

import { useState, useCallback, useEffect } from "react";
import type { ActivityLog } from "./ActivityFeed";

export function useActivityLogs(initialLogs: ActivityLog[]) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);

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

  return { logs, addOptimisticLog };
}
