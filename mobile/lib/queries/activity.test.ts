import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useActivityLogs } from "./activity";

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockLt = vi.fn();

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

vi.mock("../auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

function buildMockLogs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `log-${i}`,
    action: "expense_added",
    payload: { description: `Expense ${i}`, amountCents: 1000 + i },
    createdAt: `2025-01-${String(15 - i).padStart(2, "0")}T12:00:00Z`,
    User: { displayName: `User ${i}` },
  }));
}

describe("useActivityLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Chain: from().select().eq().order().limit() → { data, error }
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it("fetches initial page with 15-item limit", async () => {
    const logs = buildMockLogs(15);
    mockLimit.mockResolvedValueOnce({ data: logs, error: null });

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    // Verify .limit(15) was called for initial page
    expect(mockLimit).toHaveBeenCalledWith(15);
  });

  it("returns hasNextPage=true when initial page is full", async () => {
    const logs = buildMockLogs(15);
    mockLimit.mockResolvedValueOnce({ data: logs, error: null });

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.hasNextPage).toBe(true);
  });

  it("returns hasNextPage=false when initial page is partial", async () => {
    const logs = buildMockLogs(5);
    mockLimit.mockResolvedValueOnce({ data: logs, error: null });

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.hasNextPage).toBe(false);
  });

  it("flattens pages into activity log objects with actor", async () => {
    const logs = buildMockLogs(2);
    mockLimit.mockResolvedValueOnce({ data: logs, error: null });

    const { result } = renderHook(() => useActivityLogs("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const pages = result.current.data?.pages;
      return pages && pages.length > 0 && pages[0].length > 0;
    });

    const items = result.current.data!.pages.flat();
    expect(items).toHaveLength(2);
    expect(items[0].actor.displayName).toBe("User 0");
    expect(items[0].action).toBe("expense_added");
  });
});
