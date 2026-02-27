import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useCreatePayment } from "./payments";
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

describe("useCreatePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls create_payment RPC with correct params", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "pay-1", error: null } as never);

    const { result } = renderHook(() => useCreatePayment("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        amountCents: 1500,
        date: "2026-02-25",
        paidById: "user-1",
        recipientId: "user-2",
        members: testMembers,
      });
    });

    expect(mockRpcFn).toHaveBeenCalledWith("create_payment", {
      _group_id: "group-1",
      _amount_cents: 1500,
      _date: "2026-02-25",
      _paid_by_id: "user-1",
      _recipient_id: "user-2",
      _from_display_name: "Alice",
      _to_display_name: "Bob",
      _settled_up: false,
    });
  });

  it("adds optimistic payment to cache", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "pay-1", error: null } as never);

    const queryClient = createTestQueryClient();
    queryClient.setQueryData<ExpenseRow[]>(groupKeys.expenses("group-1"), []);

    const { result } = renderHook(() => useCreatePayment("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        amountCents: 1500,
        date: "2026-02-25",
        paidById: "user-1",
        recipientId: "user-2",
        members: testMembers,
      });
    });

    // onMutate set the optimistic item; invalidateQueries doesn't remove cache data
    const cache = queryClient.getQueryData<ExpenseRow[]>(
      groupKeys.expenses("group-1"),
    );
    expect(cache?.length).toBe(1);
    expect(cache?.[0]?.isPayment).toBe(true);
    expect(cache?.[0]?.isPending).toBe(true);
    expect(cache?.[0]?.description).toBe("Payment");
    expect(cache?.[0]?.paidByDisplayName).toBe("Alice");
  });

  it("includes settledUp flag in optimistic payment", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "pay-1", error: null } as never);

    const queryClient = createTestQueryClient();
    queryClient.setQueryData<ExpenseRow[]>(groupKeys.expenses("group-1"), []);

    const { result } = renderHook(() => useCreatePayment("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        amountCents: 1500,
        date: "2026-02-25",
        paidById: "user-1",
        recipientId: "user-2",
        members: testMembers,
        settledUp: true,
      });
    });

    const cache = queryClient.getQueryData<ExpenseRow[]>(
      groupKeys.expenses("group-1"),
    );
    expect(cache?.[0]?.settledUp).toBe(true);
  });

  it("rolls back on error", async () => {
    mockRpcFn.mockResolvedValueOnce({
      data: null,
      error: { message: "Payment failed" },
    } as never);

    const queryClient = createTestQueryClient();
    const existing: ExpenseRow[] = [];
    queryClient.setQueryData(groupKeys.expenses("group-1"), existing);

    const { result } = renderHook(() => useCreatePayment("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          groupId: "group-1",
          amountCents: 1500,
          date: "2026-02-25",
          paidById: "user-1",
          recipientId: "user-2",
          members: testMembers,
        });
      } catch {
        // Expected
      }
    });

    // onError restores cache synchronously
    const cache = queryClient.getQueryData<ExpenseRow[]>(
      groupKeys.expenses("group-1"),
    );
    expect(cache).toEqual(existing);
  });

  it("invalidates expenses, activity, and all groups on settled", async () => {
    mockRpcFn.mockResolvedValueOnce({ data: "pay-1", error: null } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePayment("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        groupId: "group-1",
        amountCents: 1500,
        date: "2026-02-25",
        paidById: "user-1",
        recipientId: "user-2",
        members: testMembers,
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
