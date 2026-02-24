import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockSelect, mockUpdate, mockFrom } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();
  return { mockGetUser, mockSelect, mockUpdate, mockFrom };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/groups/group-1/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "group-1" });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/groups/[id]/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    // Default: membership check succeeds
    const membershipChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "m1" } }),
          }),
        }),
      }),
    };

    // Default: update succeeds
    const updateChain = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "group-1", name: "My Group", bannerUrl: null },
              error: null,
            }),
          }),
        }),
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "GroupMember") return membershipChain;
      if (table === "Group") return updateChain;
      return {};
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(makeRequest({ name: "New Name" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "GroupMember") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await PUT(makeRequest({ name: "New Name" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid name (empty string)", async () => {
    const res = await PUT(makeRequest({ name: "" }), { params });
    expect(res.status).toBe(400);
  });

  it("accepts a name update and returns 200", async () => {
    const res = await PUT(makeRequest({ name: "Renamed Group" }), { params });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string }; error: null };
    expect(body.data.id).toBe("group-1");
    expect(body.error).toBeNull();
  });

  it("accepts bannerUrl without name", async () => {
    const res = await PUT(makeRequest({ bannerUrl: null }), { params });
    expect(res.status).toBe(200);
  });

  it("accepts both name and bannerUrl together", async () => {
    const res = await PUT(
      makeRequest({ name: "New Name", bannerUrl: null }),
      { params }
    );
    expect(res.status).toBe(200);
  });
});
