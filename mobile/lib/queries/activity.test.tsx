import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { supabase } from "../supabase";
import { useActivityLogs } from "./activity";
import { groupKeys } from "./keys";
import { createWrapper } from "./test-utils";

vi.mock("../auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1" },
    session: { user: { id: "user-1" }, access_token: "token" },
    loading: false,
    signOut: vi.fn(),
  })),
}));

afterEach(cleanup);

describe("useActivityLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches first page of activity logs", async () => {
    const mockData = [
      {
        id: "log-1",
        action: "expense_created",
        payload: { description: "Dinner" },
        createdAt: "2026-02-25T12:00:00Z",
        User: { displayName: "Alice" },
        groupId: "group-1",
      },
    ];

    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const logs = result.current.data!.pages[0];
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe("log-1");
    expect(logs[0].action).toBe("expense_created");
    expect(logs[0].actor.displayName).toBe("Alice");
    expect(logs[0].createdAt).toBe("2026-02-25T12:00:00Z");
  });

  it("normalizes timestamps without timezone suffix", async () => {
    const mockData = [
      {
        id: "log-1",
        action: "expense_created",
        payload: null,
        createdAt: "2026-02-25 12:00:00",
        User: { displayName: "Bob" },
        groupId: "group-1",
      },
    ];

    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should append Z for missing timezone
    expect(result.current.data!.pages[0][0].createdAt).toBe(
      "2026-02-25 12:00:00Z",
    );
  });

  it("uses groupKeys.activity as query key", () => {
    expect(groupKeys.activity("group-1")).toEqual([
      "groups",
      "group-1",
      "activity",
    ]);
  });

  it("falls back to 'Unknown' for null actor", async () => {
    const mockData = [
      {
        id: "log-1",
        action: "member_removed",
        payload: null,
        createdAt: "2026-02-25T12:00:00Z",
        User: null,
        groupId: "group-1",
      },
    ];

    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.pages[0][0].actor.displayName).toBe("Unknown");
  });

  it("is disabled when groupId is empty", () => {
    const { result } = renderHook(() => useActivityLogs(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("throws on Supabase error", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Table not found" },
            }),
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
