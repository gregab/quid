import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";
import {
  useRecurringExpenses,
  useStopRecurringExpense,
  type RecurringExpenseRow,
} from "./recurring";
import { groupKeys } from "./keys";
import { createTestQueryClient, createWrapper } from "./test-utils";

const { mockRpcFn, mockFromFn } = vi.hoisted(() => {
  const mockFromFn = vi.fn();
  return {
    mockRpcFn: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockFromFn,
  };
});

vi.mock("../supabase", () => ({
  supabase: {
    rpc: mockRpcFn,
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: mockFromFn,
  },
}));

const mockUser = { id: "user-1", email: "test@example.com" };
vi.mock("../auth", () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    session: { user: mockUser, access_token: "token" },
    loading: false,
    signOut: vi.fn(),
  })),
}));

afterEach(cleanup);

describe("useRecurringExpenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches active recurring expenses for a group", async () => {
    const mockData = [
      {
        id: "rec-1",
        description: "Weekly groceries",
        amountCents: 5000,
        frequency: "weekly",
        nextDueDate: "2026-03-01T00:00:00Z",
        isActive: true,
        User: { displayName: "Alice" },
      },
      {
        id: "rec-2",
        description: "Monthly rent",
        amountCents: 100000,
        frequency: "monthly",
        nextDueDate: "2026-04-01T00:00:00Z",
        isActive: true,
        User: { displayName: "Bob" },
      },
    ];

    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    mockFromFn.mockReturnValue(chainMock);

    const { result } = renderHook(() => useRecurringExpenses("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFromFn).toHaveBeenCalledWith("RecurringExpense");
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      id: "rec-1",
      description: "Weekly groceries",
      amountCents: 5000,
      frequency: "weekly",
      nextDueDate: "2026-03-01",
      paidByDisplayName: "Alice",
      isActive: true,
    });
    expect(result.current.data![1]!.paidByDisplayName).toBe("Bob");
  });

  it("returns empty array when no recurring expenses exist", async () => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFromFn.mockReturnValue(chainMock);

    const { result } = renderHook(() => useRecurringExpenses("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("throws on supabase error", async () => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "RLS error" } }),
    };
    mockFromFn.mockReturnValue(chainMock);

    const { result } = renderHook(() => useRecurringExpenses("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useStopRecurringExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls stop_recurring_expense RPC with correct params", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: null, error: null } as never);

    const { result } = renderHook(
      () => useStopRecurringExpense("group-1"),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync("rec-1");
    });

    expect(mockRpcFn).toHaveBeenCalledWith("stop_recurring_expense", {
      _recurring_id: "rec-1",
    });
  });

  it("optimistically removes the recurring expense from cache", async () => {
    let resolveRpc: (value: unknown) => void;
    mockRpcFn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRpc = resolve;
      }) as never,
    );

    const queryClient = createTestQueryClient();
    const existing: RecurringExpenseRow[] = [
      {
        id: "rec-1",
        description: "Weekly groceries",
        amountCents: 5000,
        frequency: "weekly",
        nextDueDate: "2026-03-01",
        paidByDisplayName: "Alice",
        isActive: true,
      },
      {
        id: "rec-2",
        description: "Monthly rent",
        amountCents: 100000,
        frequency: "monthly",
        nextDueDate: "2026-04-01",
        paidByDisplayName: "Bob",
        isActive: true,
      },
    ];
    queryClient.setQueryData(
      groupKeys.recurringExpenses("group-1"),
      existing,
    );

    const { result } = renderHook(
      () => useStopRecurringExpense("group-1"),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate("rec-1");
    });

    const cache = queryClient.getQueryData<RecurringExpenseRow[]>(
      groupKeys.recurringExpenses("group-1"),
    );
    expect(cache).toHaveLength(1);
    expect(cache![0]!.id).toBe("rec-2");

    await act(async () => {
      resolveRpc!({ data: null, error: null });
    });
  });

  it("rolls back cache on error", async () => {
    mockRpcFn.mockResolvedValueOnce({
      data: null,
      error: { message: "Not authorized" },
    } as never);

    const queryClient = createTestQueryClient();
    const existing: RecurringExpenseRow[] = [
      {
        id: "rec-1",
        description: "Weekly groceries",
        amountCents: 5000,
        frequency: "weekly",
        nextDueDate: "2026-03-01",
        paidByDisplayName: "Alice",
        isActive: true,
      },
    ];
    queryClient.setQueryData(
      groupKeys.recurringExpenses("group-1"),
      existing,
    );

    const { result } = renderHook(
      () => useStopRecurringExpense("group-1"),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync("rec-1");
      } catch {
        // Expected
      }
    });

    await waitFor(() => {
      const cache = queryClient.getQueryData<RecurringExpenseRow[]>(
        groupKeys.recurringExpenses("group-1"),
      );
      expect(cache).toEqual(existing);
    });
  });

  it("invalidates recurring expenses and expenses on settled", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: null, error: null } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () => useStopRecurringExpense("group-1"),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync("rec-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.recurringExpenses("group-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.expenses("group-1"),
    });
  });
});
