import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "../test-utils";
import { useCreateFriendExpense } from "./friends";

// Mock auth
vi.mock("../auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1" },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
}));

// Mock supabase
const mockRpc = vi.fn();
const mockSingle = vi.fn();

vi.mock("../supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: () => mockSingle(),
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "tok" } },
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

describe("useCreateFriendExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: profile lookups succeed
    mockSingle.mockResolvedValue({
      data: { displayName: "Alice" },
      error: null,
    });
    // Default: RPCs succeed
    mockRpc.mockResolvedValue({ data: "group-1", error: null });
  });

  it("calls get_or_create_friend_group then create_expense for 1 friend", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: "group-1", error: null }) // get_or_create_friend_group
      .mockResolvedValueOnce({ error: null }); // create_expense

    const { result } = renderHook(() => useCreateFriendExpense(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        friendIds: ["friend-1"],
        description: "Coffee",
        amountCents: 1000,
        date: "2026-02-25",
      });
    });

    // Should call get_or_create_friend_group
    const friendGroupCall = mockRpc.mock.calls.find(
      (c: unknown[]) => c[0] === "get_or_create_friend_group",
    );
    expect(friendGroupCall).toBeDefined();
    expect(friendGroupCall![1]).toEqual({ _other_user_id: "friend-1" });

    // Should call create_expense
    const createCall = mockRpc.mock.calls.find(
      (c: unknown[]) => c[0] === "create_expense",
    );
    expect(createCall).toBeDefined();
    const params = createCall![1] as Record<string, unknown>;
    expect(params._amount_cents).toBe(1000);
    expect(params._group_id).toBe("group-1");
    expect(params._split_type).toBe("custom");
    // $10 / 2 = $5 each → my share 500, friend share 500
    expect(params._split_amounts).toEqual([500, 500]);
  });

  it("creates separate expenses for 2 friends", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: "group-1", error: null }) // friend group 1
      .mockResolvedValueOnce({ error: null }) // create_expense 1
      .mockResolvedValueOnce({ data: "group-2", error: null }) // friend group 2
      .mockResolvedValueOnce({ error: null }); // create_expense 2

    const { result } = renderHook(() => useCreateFriendExpense(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        friendIds: ["friend-1", "friend-2"],
        description: "Dinner",
        amountCents: 3000,
        date: "2026-02-25",
      });
    });

    // Should have 2 get_or_create_friend_group calls
    const friendGroupCalls = mockRpc.mock.calls.filter(
      (c: unknown[]) => c[0] === "get_or_create_friend_group",
    );
    expect(friendGroupCalls.length).toBe(2);

    // Should have 2 create_expense calls
    const createCalls = mockRpc.mock.calls.filter(
      (c: unknown[]) => c[0] === "create_expense",
    );
    expect(createCalls.length).toBe(2);

    // $30 / 3 people = $10 each
    // Each friend group: myShare = 3000 - 1000 = 2000, friendShare = 1000
    const p1 = createCalls[0]![1] as Record<string, unknown>;
    expect(p1._split_amounts).toEqual([2000, 1000]);
    expect(p1._group_id).toBe("group-1");

    const p2 = createCalls[1]![1] as Record<string, unknown>;
    expect(p2._split_amounts).toEqual([2000, 1000]);
    expect(p2._group_id).toBe("group-2");
  });

  it("uses friend as payer when specified", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: "group-1", error: null })
      .mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useCreateFriendExpense(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        friendIds: ["friend-1"],
        description: "Taxi",
        amountCents: 2400,
        date: "2026-02-25",
        paidById: "friend-1",
      });
    });

    const createCall = mockRpc.mock.calls.find(
      (c: unknown[]) => c[0] === "create_expense",
    );
    const params = createCall![1] as Record<string, unknown>;
    expect(params._paid_by_id).toBe("friend-1");
  });

  it("throws on RPC error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const { result } = renderHook(() => useCreateFriendExpense(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          friendIds: ["friend-1"],
          description: "Test",
          amountCents: 500,
          date: "2026-02-25",
        });
      }),
    ).rejects.toThrow("DB error");
  });
});
