// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActivityLogs } from "./useActivityLogs";
import type { ActivityLog } from "./ActivityFeed";

function makeLog(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: "log-1",
    action: "expense_added",
    payload: { description: "Dinner", amountCents: 2500, paidByDisplayName: "Alice" },
    createdAt: new Date("2024-01-15T12:00:00Z"),
    actor: { displayName: "Alice" },
    ...overrides,
  };
}

const GROUP_ID = "group-1";

describe("useActivityLogs", () => {
  it("returns initial logs unchanged", () => {
    const logs = [makeLog()];
    const { result } = renderHook(
      ({ l }: { l: ActivityLog[] }) => useActivityLogs(l, GROUP_ID, false),
      { initialProps: { l: logs } }
    );
    expect(result.current.logs).toEqual(logs);
  });

  it("addOptimisticLog prepends a pending log to the front of the list", () => {
    const existing = makeLog({ id: "log-1" });
    const { result } = renderHook(
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs, GROUP_ID, false),
      { initialProps: { logs: [existing] } }
    );

    const newLog = makeLog({ id: "pending-1", isPending: true });

    act(() => {
      result.current.addOptimisticLog(newLog);
    });

    expect(result.current.logs[0]).toEqual(newLog);
    expect(result.current.logs[1]).toEqual(existing);
    expect(result.current.logs).toHaveLength(2);
  });

  it("reconciles pending logs when initialLogs prop updates", () => {
    const initial = [makeLog({ id: "log-1", isPending: false })];
    const { result, rerender } = renderHook(
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs, GROUP_ID, false),
      { initialProps: { logs: initial } }
    );

    act(() => {
      result.current.addOptimisticLog(makeLog({ id: "pending-1", isPending: true }));
    });
    expect(result.current.logs).toHaveLength(2);

    const fresh = [makeLog({ id: "real-1", isPending: false }), ...initial];
    rerender({ logs: fresh });

    expect(result.current.logs).toEqual(fresh);
    expect(result.current.logs.every((l) => !l.isPending)).toBe(true);
  });

  it("does not replace state on prop update when there are no pending logs", () => {
    const initial = [makeLog({ id: "log-1", isPending: false })];
    const { result, rerender } = renderHook(
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs, GROUP_ID, false),
      { initialProps: { logs: initial } }
    );

    const differentLogs = [makeLog({ id: "different-1", isPending: false })];
    rerender({ logs: differentLogs });

    expect(result.current.logs).toEqual(initial);
  });

  it("adds multiple optimistic logs in order", () => {
    const empty: ActivityLog[] = [];
    const { result } = renderHook(
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs, GROUP_ID, false),
      { initialProps: { logs: empty } }
    );

    act(() => {
      result.current.addOptimisticLog(makeLog({ id: "pending-1", action: "expense_added" }));
    });
    act(() => {
      result.current.addOptimisticLog(makeLog({ id: "pending-2", action: "expense_edited" }));
    });

    expect(result.current.logs[0]!.id).toBe("pending-2");
    expect(result.current.logs[1]!.id).toBe("pending-1");
    expect(result.current.logs).toHaveLength(2);
  });

  it("initializes hasMore from the initialHasMore argument", () => {
    const { result } = renderHook(() =>
      useActivityLogs([makeLog()], GROUP_ID, true)
    );
    expect(result.current.hasMore).toBe(true);
  });

  it("hasMore is false when initialHasMore is false", () => {
    const { result } = renderHook(() =>
      useActivityLogs([makeLog()], GROUP_ID, false)
    );
    expect(result.current.hasMore).toBe(false);
  });

  describe("loadMore", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            logs: [makeLog({ id: "log-older", createdAt: "2024-01-10T12:00:00Z" })],
            hasMore: false,
          },
        }),
      } as Response);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("appends fetched logs and updates hasMore", async () => {
      const initial = [makeLog({ id: "log-1", createdAt: "2024-01-15T12:00:00Z" })];
      const { result } = renderHook(() =>
        useActivityLogs(initial, GROUP_ID, true)
      );

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs[1]!.id).toBe("log-older");
      expect(result.current.hasMore).toBe(false);
    });

    it("does not duplicate logs already in state", async () => {
      const existingLog = makeLog({ id: "log-older", createdAt: "2024-01-10T12:00:00Z" });
      const initial = [
        makeLog({ id: "log-1", createdAt: "2024-01-15T12:00:00Z" }),
        existingLog,
      ];
      const { result } = renderHook(() =>
        useActivityLogs(initial, GROUP_ID, true)
      );

      await act(async () => {
        await result.current.loadMore();
      });

      // log-older is already present — should not be duplicated
      expect(result.current.logs.filter((l) => l.id === "log-older")).toHaveLength(1);
    });

    it("does not fetch when hasMore is false", async () => {
      const { result } = renderHook(() =>
        useActivityLogs([makeLog()], GROUP_ID, false)
      );

      await act(async () => {
        await result.current.loadMore();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
