import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";
import { supabase } from "../supabase";
import { useInvitePreview, useJoinGroup } from "./invite";
import { inviteKeys, groupKeys } from "./keys";
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

describe("useInvitePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches invite preview via get_group_by_invite_token RPC", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: {
        id: "group-1",
        name: "Test Group",
        member_count: 3,
        is_member: false,
      },
      error: null,
    } as never);

    const { result } = renderHook(() => useInvitePreview("abc-token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      id: "group-1",
      name: "Test Group",
      memberCount: 3,
      isMember: false,
    });

    expect(mockRpc).toHaveBeenCalledWith("get_group_by_invite_token", {
      _token: "abc-token",
    });
  });

  it("uses inviteKeys.preview as query key", () => {
    expect(inviteKeys.preview("abc-token")).toEqual(["invite", "abc-token"]);
  });

  it("throws 'Invalid invite link' when data is null", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({ data: null, error: null } as never);

    const { result } = renderHook(() => useInvitePreview("bad-token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Invalid invite link");
  });

  it("throws on RPC error", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Token expired" },
    } as never);

    const { result } = renderHook(() => useInvitePreview("expired-token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("is disabled when token is empty", () => {
    const { result } = renderHook(() => useInvitePreview(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useJoinGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls join_group_by_token RPC", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: { groupId: "group-1", alreadyMember: false },
      error: null,
    } as never);

    const { result } = renderHook(() => useJoinGroup(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const data = await result.current.mutateAsync("abc-token");
      expect(data).toEqual({ groupId: "group-1", alreadyMember: false });
    });

    expect(mockRpc).toHaveBeenCalledWith("join_group_by_token", {
      _token: "abc-token",
    });
  });

  it("invalidates all groups on success", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: { groupId: "group-1", alreadyMember: false },
      error: null,
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useJoinGroup(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("abc-token");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKeys.all,
    });
  });

  it("throws on RPC error", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Already a member" },
    } as never);

    const { result } = renderHook(() => useJoinGroup(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync("abc-token"),
    ).rejects.toEqual({ message: "Already a member" });
  });
});
