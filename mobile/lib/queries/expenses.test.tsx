import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useCreateExpense, useUpdateExpense, useDeleteExpense } from "./expenses";
import { groupKeys } from "./keys";
import { createTestQueryClient, createWrapper } from "./test-utils";
import type { ExpenseRow, Member } from "../types";

const { mockRpcFn } = vi.hoisted(() => ({
  mockRpcFn: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("../supabase", () => ({
  supabase: {
    rpc: mockRpcFn,
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
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

const testMembers: Member[] = [
  { userId: "user-1", displayName: "Alice" },
  { userId: "user-2", displayName: "Bob" },
];

describe("useCreateExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls create_expense RPC with correct params", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "exp-new", error: null } as never);

    const { result } = renderHook(() => useCreateExpense("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        description: "Lunch",
        amountCents: 2000,
        date: "2026-02-25",
        paidById: "user-1",
        participantIds: ["user-1", "user-2"],
        members: testMembers,
        splitType: "equal",
      });
    });

    expect(mockRpcFn).toHaveBeenCalledWith("create_expense", expect.objectContaining({
      _group_id: "group-1",
      _description: "Lunch",
      _amount_cents: 2000,
      _date: "2026-02-25",
      _paid_by_id: "user-1",
      _participant_ids: ["user-1", "user-2"],
      _paid_by_display_name: "Alice",
      _split_type: "equal",
    }));
  });

  it("calls create_recurring_expense RPC when recurringFrequency is set", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "rec-new", error: null } as never);

    const { result } = renderHook(() => useCreateExpense("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        description: "Rent",
        amountCents: 100000,
        date: "2026-03-01",
        paidById: "user-1",
        participantIds: ["user-1", "user-2"],
        members: testMembers,
        splitType: "equal",
        recurringFrequency: "monthly",
      });
    });

    expect(mockRpcFn).toHaveBeenCalledWith(
      "create_recurring_expense",
      expect.objectContaining({
        _frequency: "monthly",
        _group_id: "group-1",
      }),
    );
  });

  it("adds optimistic expense to cache on mutate", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "exp-new", error: null } as never);

    const queryClient = createTestQueryClient();
    queryClient.setQueryData<ExpenseRow[]>(groupKeys.expenses("group-1"), []);

    const { result } = renderHook(() => useCreateExpense("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        description: "Optimistic Test",
        amountCents: 1000,
        date: "2026-02-25",
        paidById: "user-1",
        participantIds: ["user-1", "user-2"],
        members: testMembers,
        splitType: "equal",
      });
    });

    // onMutate set the optimistic item; invalidateQueries (onSettled) doesn't remove it
    const cache = queryClient.getQueryData<ExpenseRow[]>(
      groupKeys.expenses("group-1"),
    );
    expect(cache?.length).toBe(1);
    expect(cache?.[0]?.description).toBe("Optimistic Test");
    expect(cache?.[0]?.isPending).toBe(true);
  });

  it("rolls back optimistic update on error", async () => {
    mockRpcFn.mockResolvedValueOnce({
      data: null,
      error: { message: "Server error" },
    } as never);

    const queryClient = createTestQueryClient();
    const existingExpenses: ExpenseRow[] = [
      {
        id: "existing-1",
        description: "Existing",
        amountCents: 500,
        date: "2026-02-24",
        paidById: "user-1",
        paidByDisplayName: "Alice",
        participantIds: ["user-1"],
        splits: [{ userId: "user-1", amountCents: 500 }],
        splitType: "equal",
        canEdit: true,
        canDelete: true,
      },
    ];
    queryClient.setQueryData(groupKeys.expenses("group-1"), existingExpenses);

    const { result } = renderHook(() => useCreateExpense("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          groupId: "group-1",
          description: "Will Fail",
          amountCents: 1000,
          date: "2026-02-25",
          paidById: "user-1",
          participantIds: ["user-1"],
          members: testMembers,
          splitType: "equal",
        });
      } catch {
        // Expected
      }
    });

    // onError restores the previous cache synchronously
    const cache = queryClient.getQueryData<ExpenseRow[]>(
      groupKeys.expenses("group-1"),
    );
    expect(cache).toEqual(existingExpenses);
  });

  it("maps percentage splitType to custom for RPC", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "exp-pct", error: null } as never);

    const { result } = renderHook(() => useCreateExpense("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        description: "Percentage Split",
        amountCents: 3000,
        date: "2026-02-25",
        paidById: "user-1",
        participantIds: ["user-1", "user-2"],
        members: testMembers,
        splitType: "percentage",
        splitAmounts: [1800, 1200],
      });
    });

    expect(mockRpcFn).toHaveBeenCalledWith(
      "create_expense",
      expect.objectContaining({ _split_type: "custom" }),
    );
  });

  it("invalidates expenses, activity, and groups on settled", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "exp-new", error: null } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateExpense("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        description: "Test",
        amountCents: 1000,
        date: "2026-02-25",
        paidById: "user-1",
        participantIds: ["user-1"],
        members: testMembers,
        splitType: "equal",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.expenses("group-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.activity("group-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.all,
    });
  });
});

describe("useUpdateExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls update_expense RPC with correct params", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: null, error: null } as never);

    const { result } = renderHook(() => useUpdateExpense("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        expenseId: "exp-1",
        groupId: "group-1",
        description: "Updated Lunch",
        amountCents: 2500,
        date: "2026-02-25",
        paidById: "user-1",
        participantIds: ["user-1", "user-2"],
        members: testMembers,
        splitType: "equal",
        changes: { description: { from: "Lunch", to: "Updated Lunch" } },
        splitsBefore: [{ displayName: "Alice", amountCents: 1000 }],
        splitsAfter: [{ displayName: "Alice", amountCents: 1250 }],
      });
    });

    expect(mockRpcFn).toHaveBeenCalledWith("update_expense", expect.objectContaining({
      _expense_id: "exp-1",
      _description: "Updated Lunch",
      _amount_cents: 2500,
    }));
  });

  it("throws on RPC error", async () => {
    mockRpcFn.mockResolvedValueOnce({
      data: null,
      error: { message: "Not authorized" },
    } as never);

    const { result } = renderHook(() => useUpdateExpense("group-1"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        expenseId: "exp-1",
        groupId: "group-1",
        description: "Test",
        amountCents: 1000,
        date: "2026-02-25",
        paidById: "user-1",
        participantIds: ["user-1"],
        members: testMembers,
        splitType: "equal",
        changes: {},
        splitsBefore: [],
        splitsAfter: [],
      }),
    ).rejects.toEqual({ message: "Not authorized" });
  });
});

describe("useDeleteExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls delete_expense RPC", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: null, error: null } as never);

    const { result } = renderHook(() => useDeleteExpense("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        expenseId: "exp-1",
        description: "Dinner",
        amountCents: 3000,
        paidByDisplayName: "Alice",
        date: "2026-01-15",
        participantDisplayNames: ["Alice", "Bob"],
      });
    });

    expect(mockRpcFn).toHaveBeenCalledWith("delete_expense", {
      _expense_id: "exp-1",
      _group_id: "group-1",
      _description: "Dinner",
      _amount_cents: 3000,
      _paid_by_display_name: "Alice",
      _date: "2026-01-15",
      _participant_display_names: ["Alice", "Bob"],
    });
  });

  it("optimistically removes expense from cache", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: null, error: null } as never);

    const queryClient = createTestQueryClient();
    const expenses: ExpenseRow[] = [
      {
        id: "exp-1",
        description: "To Delete",
        amountCents: 1000,
        date: "2026-02-24",
        paidById: "user-1",
        paidByDisplayName: "Alice",
        participantIds: ["user-1"],
        splits: [{ userId: "user-1", amountCents: 1000 }],
        splitType: "equal",
        canEdit: true,
        canDelete: true,
      },
      {
        id: "exp-2",
        description: "Keep",
        amountCents: 2000,
        date: "2026-02-24",
        paidById: "user-1",
        paidByDisplayName: "Alice",
        participantIds: ["user-1"],
        splits: [{ userId: "user-1", amountCents: 2000 }],
        splitType: "equal",
        canEdit: true,
        canDelete: true,
      },
    ];
    queryClient.setQueryData(groupKeys.expenses("group-1"), expenses);

    const { result } = renderHook(() => useDeleteExpense("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        expenseId: "exp-1",
        description: "To Delete",
        amountCents: 1000,
        paidByDisplayName: "Alice",
        date: "2026-02-24",
        participantDisplayNames: ["Alice"],
      });
    });

    // onMutate filtered out exp-1; invalidateQueries doesn't remove cache data
    const cache = queryClient.getQueryData<ExpenseRow[]>(
      groupKeys.expenses("group-1"),
    );
    expect(cache?.length).toBe(1);
    expect(cache?.[0]?.id).toBe("exp-2");
  });

  it("rolls back on error", async () => {
    mockRpcFn.mockResolvedValueOnce({
      data: null,
      error: { message: "Cannot delete" },
    } as never);

    const queryClient = createTestQueryClient();
    const expenses: ExpenseRow[] = [
      {
        id: "exp-1",
        description: "Keep",
        amountCents: 1000,
        date: "2026-02-24",
        paidById: "user-1",
        paidByDisplayName: "Alice",
        participantIds: ["user-1"],
        splits: [{ userId: "user-1", amountCents: 1000 }],
        splitType: "equal",
        canEdit: true,
        canDelete: true,
      },
    ];
    queryClient.setQueryData(groupKeys.expenses("group-1"), expenses);

    const { result } = renderHook(() => useDeleteExpense("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          expenseId: "exp-1",
          description: "Keep",
          amountCents: 1000,
          paidByDisplayName: "Alice",
          date: "2026-02-24",
          participantDisplayNames: ["Alice"],
        });
      } catch {
        // Expected
      }
    });

    // onError restores cache synchronously
    const cache = queryClient.getQueryData<ExpenseRow[]>(
      groupKeys.expenses("group-1"),
    );
    expect(cache).toEqual(expenses);
  });
});
