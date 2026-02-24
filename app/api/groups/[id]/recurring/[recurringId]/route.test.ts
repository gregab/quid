import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRpc, mockGetUser } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/groups/group-1/recurring/rec-1", {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/groups/[id]/recurring/[recurringId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockRpc.mockResolvedValue({ error: null });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "group-1", recurringId: "rec-1" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("calls stop_recurring_expense RPC with the recurringId", async () => {
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "group-1", recurringId: "rec-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("stop_recurring_expense", {
      _recurring_id: "rec-1",
    });
  });

  it("returns 500 when RPC fails", async () => {
    mockRpc.mockResolvedValue({ error: { message: "Not a member of this group" } });

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "group-1", recurringId: "rec-1" }),
    });

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Not a member of this group");
  });
});
