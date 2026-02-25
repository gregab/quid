import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { supabase } from "../supabase";
import { useGroups, useGroupDetail, useGroupExpenses, useCreateGroup } from "./groups";
import { groupKeys } from "./keys";
import { createTestQueryClient, createWrapper } from "./test-utils";

// Mock auth
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

describe("useGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when user has no groups", async () => {
    const mockFrom = vi.mocked(supabase.from);
    // First call: GroupMember.select → empty memberships
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("uses groupKeys.all as query key", () => {
    expect(groupKeys.all).toEqual(["groups"]);
  });

  it("throws on Supabase error", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "RLS error" },
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ message: "RLS error" });
  });
});

describe("useGroupDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches group with members via select join", async () => {
    const mockData = {
      id: "group-1",
      name: "Test Group",
      GroupMember: [
        { userId: "user-1", User: { displayName: "Alice" } },
      ],
    };

    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useGroupDetail("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it("uses groupKeys.detail as query key", () => {
    expect(groupKeys.detail("group-1")).toEqual(["groups", "group-1"]);
  });

  it("is disabled when groupId is empty", () => {
    const { result } = renderHook(() => useGroupDetail(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("throws on Supabase error", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useGroupDetail("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useGroupExpenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and transforms expenses correctly", async () => {
    const mockData = [
      {
        id: "exp-1",
        description: "Dinner",
        amountCents: 3000,
        date: "2026-02-20T00:00:00Z",
        paidById: "user-1",
        groupId: "group-1",
        isPayment: false,
        settledUp: false,
        splitType: "equal",
        createdById: "user-1",
        createdAt: "2026-02-20T12:00:00Z",
        updatedAt: null,
        recurringExpenseId: null,
        User: { displayName: "Alice" },
        ExpenseSplit: [
          { userId: "user-1", amountCents: 1500 },
          { userId: "user-2", amountCents: 1500 },
        ],
        RecurringExpense: null,
      },
    ];

    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useGroupExpenses("group-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const expense = result.current.data![0];
    expect(expense.id).toBe("exp-1");
    expect(expense.description).toBe("Dinner");
    expect(expense.paidByDisplayName).toBe("Alice");
    expect(expense.date).toBe("2026-02-20");
    expect(expense.splits).toEqual([
      { userId: "user-1", amountCents: 1500 },
      { userId: "user-2", amountCents: 1500 },
    ]);
    expect(expense.canEdit).toBe(true); // createdById matches mock user
    expect(expense.canDelete).toBe(true);
  });

  it("uses groupKeys.expenses as query key", () => {
    expect(groupKeys.expenses("group-1")).toEqual([
      "groups",
      "group-1",
      "expenses",
    ]);
  });
});

describe("useCreateGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls create_group RPC and returns group ID", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: "new-group-id",
      error: null,
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync("My Group");

    expect(mockRpc).toHaveBeenCalledWith("create_group", { _name: "My Group" });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.all,
    });
  });

  it("throws on RPC error", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Group name too long" },
    } as never);

    const { result } = renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("x".repeat(100))).rejects.toEqual({
      message: "Group name too long",
    });
  });
});
