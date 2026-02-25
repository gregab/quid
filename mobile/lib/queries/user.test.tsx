import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";
import { supabase } from "../supabase";
import { useCurrentUser, useUpdateProfile, useDeleteAccount } from "./user";
import { userKeys } from "./keys";
import { createTestQueryClient, createWrapper } from "./test-utils";

const mockSignOut = vi.fn();
const mockUser = { id: "user-1", email: "test@example.com" };
vi.mock("../auth", () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    session: { user: mockUser, access_token: "token" },
    loading: false,
    signOut: mockSignOut,
  })),
}));

afterEach(cleanup);

describe("useCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches current user profile from User table", async () => {
    const mockProfile = {
      id: "user-1",
      email: "test@example.com",
      displayName: "Alice",
      avatarUrl: null,
      profilePictureUrl: null,
      defaultEmoji: "🦊",
    };

    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProfile);
    expect(result.current.data!.displayName).toBe("Alice");
  });

  it("uses userKeys.profile as query key", () => {
    expect(userKeys.profile).toEqual(["user", "profile"]);
  });

  it("throws on Supabase error", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Row not found" },
          }),
        }),
      }),
    } as never);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Supabase update with new display name", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({ update: mockUpdate } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ displayName: "New Name" });
    });

    expect(mockUpdate).toHaveBeenCalledWith({ displayName: "New Name" });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: userKeys.profile,
    });
  });

  it("throws on Supabase error", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Update failed" },
        }),
      }),
    } as never);

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ displayName: "Test" }),
    ).rejects.toEqual({ message: "Update failed" });
  });
});

describe("useDeleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls delete_account RPC and signs out on success", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({ data: null, error: null } as never);
    mockSignOut.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockRpc).toHaveBeenCalledWith("delete_account");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("throws on RPC error without signing out", async () => {
    const mockRpc = vi.mocked(supabase.rpc);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Cannot delete" },
    } as never);

    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync()).rejects.toEqual({
      message: "Cannot delete",
    });

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
