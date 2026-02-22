// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
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

describe("useActivityLogs", () => {
  it("returns initial logs unchanged", () => {
    const logs = [makeLog()];
    const { result } = renderHook(
      ({ l }: { l: ActivityLog[] }) => useActivityLogs(l),
      { initialProps: { l: logs } }
    );
    expect(result.current.logs).toEqual(logs);
  });

  it("addOptimisticLog prepends a pending log to the front of the list", () => {
    const existing = makeLog({ id: "log-1" });
    // Use initialProps so renderHook doesn't recreate the array on each render,
    // which would cause useEffect to fire and reset state after addOptimisticLog.
    const { result } = renderHook(
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs),
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
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs),
      { initialProps: { logs: initial } }
    );

    // Simulate optimistic log added before server responds
    act(() => {
      result.current.addOptimisticLog(makeLog({ id: "pending-1", isPending: true }));
    });
    expect(result.current.logs).toHaveLength(2);

    // Simulate router.refresh() delivering fresh server data with the real log
    const fresh = [makeLog({ id: "real-1", isPending: false }), ...initial];
    rerender({ logs: fresh });

    // Pending log replaced by fresh server data
    expect(result.current.logs).toEqual(fresh);
    expect(result.current.logs.every((l) => !l.isPending)).toBe(true);
  });

  it("does not replace state on prop update when there are no pending logs", () => {
    const initial = [makeLog({ id: "log-1", isPending: false })];
    const { result, rerender } = renderHook(
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs),
      { initialProps: { logs: initial } }
    );

    // No pending logs — prop change should NOT override state
    const differentLogs = [makeLog({ id: "different-1", isPending: false })];
    rerender({ logs: differentLogs });

    // State unchanged because no pending logs existed
    expect(result.current.logs).toEqual(initial);
  });

  it("adds multiple optimistic logs in order", () => {
    const empty: ActivityLog[] = [];
    const { result } = renderHook(
      ({ logs }: { logs: ActivityLog[] }) => useActivityLogs(logs),
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
});
