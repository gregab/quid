import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { supabase } from "../supabase";
import { useAddMember, useLeaveGroup } from "./members";
import { groupKeys } from "./keys";
import { createTestQueryClient, createWrapper } from "./test-utils";

vi.mock("../auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1" },
    session: { user: { id: "user-1" }, access_token: "token" },
    loading: false,
    signOut: vi.fn(),
  })),
}));

afterEach(cleanup);

describe("useAddMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls add_member_by_email RPC with lowercased trimmed email", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: { userId: "user-2", displayName: "Bob", groupId: "group-1", joinedAt: "2026-02-25" },
      error: null,
    } as never);

    const { result } = renderHook(() => useAddMember("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("  Bob@Example.COM  ");
    });

    expect(mockRpc).toHaveBeenCalledWith("add_member_by_email", {
      _group_id: "group-1",
      _email: "bob@example.com",
    });
  });

  it("invalidates detail, members, and all groups on success", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: { userId: "user-2", displayName: "Bob", groupId: "group-1", joinedAt: "2026-02-25" },
      error: null,
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddMember("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("bob@example.com");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.detail("group-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.members("group-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.all,
    });
  });

  it("throws on RPC error", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "User not found" },
    } as never);

    const { result } = renderHook(() => useAddMember("group-1"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync("unknown@example.com"),
    ).rejects.toEqual({ message: "User not found" });
  });
});

describe("useLeaveGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls leave_group RPC", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: { deleted_group: false },
      error: null,
    } as never);

    const { result } = renderHook(() => useLeaveGroup("group-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockRpc).toHaveBeenCalledWith("leave_group", {
      _group_id: "group-1",
    });
  });

  it("invalidates all groups and removes group-specific caches on success", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: { deleted_group: false },
      error: null,
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const removeSpy = vi.spyOn(queryClient, "removeQueries");

    const { result } = renderHook(() => useLeaveGroup("group-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.all,
    });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.detail("group-1"),
    });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.expenses("group-1"),
    });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.activity("group-1"),
    });
  });

  it("throws on RPC error", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Outstanding balance" },
    } as never);

    const { result } = renderHook(() => useLeaveGroup("group-1"), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync()).rejects.toEqual({
      message: "Outstanding balance",
    });
  });
});
