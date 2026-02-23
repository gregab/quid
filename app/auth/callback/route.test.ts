/**
 * Unit tests for app/auth/callback/route.ts
 *
 * The email-confirmation step (Supabase sending a code in an email) can't be
 * exercised in Cypress, so we test the route handler directly by mocking the
 * Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// ---------------------------------------------------------------------------
// Mocks
// vi.mock factories are hoisted, so declare shared mocks with vi.hoisted().
// ---------------------------------------------------------------------------

const { mockUpsert, mockRpc, mockExchangeCode } = vi.hoisted(() => ({
  mockUpsert: vi.fn().mockResolvedValue({ error: null }),
  mockRpc: vi.fn(),
  mockExchangeCode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mockExchangeCode,
    },
    from: () => ({ upsert: mockUpsert }),
    rpc: mockRpc,
  }),
}));

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string) {
  return new Request(`http://localhost:3000${path}`);
}

const fakeUser = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: { display_name: "Test User" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCode.mockResolvedValue({ data: { user: fakeUser } });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("redirects to /dashboard when no code or next param", async () => {
    mockExchangeCode.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest("/auth/callback"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirects to /dashboard after exchanging a code with no ?next=", async () => {
    const res = await GET(makeRequest("/auth/callback?code=abc123"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("upserts the User row when a code is present", async () => {
    await GET(makeRequest("/auth/callback?code=abc123"));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", email: "test@example.com" }),
      expect.any(Object)
    );
  });

  it("falls back to email prefix for displayName when user has no display_name metadata", async () => {
    mockExchangeCode.mockResolvedValue({
      data: { user: { ...fakeUser, user_metadata: {} } },
    });
    await GET(makeRequest("/auth/callback?code=abc123"));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "test" }),
      expect.any(Object)
    );
  });

  describe("?next= handling", () => {
    it("redirects to ?next= path for non-invite destinations", async () => {
      const res = await GET(
        makeRequest("/auth/callback?code=abc123&next=%2Fdashboard")
      );
      expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("auto-joins the group and redirects to it when next= is an invite path", async () => {
      mockRpc.mockResolvedValue({
        data: { groupId: "group-99", alreadyMember: false },
        error: null,
      });

      const res = await GET(
        makeRequest("/auth/callback?code=abc123&next=%2Finvite%2Fmy-token")
      );

      expect(mockRpc).toHaveBeenCalledWith("join_group_by_token", { _token: "my-token" });
      expect(res.headers.get("location")).toBe(
        "http://localhost:3000/groups/group-99"
      );
    });

    it("falls back to the invite page when the token is invalid (join returns no data)", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "Invalid invite token" } });

      const res = await GET(
        makeRequest("/auth/callback?code=abc123&next=%2Finvite%2Fbad-token")
      );

      expect(res.headers.get("location")).toBe(
        "http://localhost:3000/invite/bad-token"
      );
    });

    it("rejects open-redirect attempts (absolute URLs in ?next=)", async () => {
      const res = await GET(
        makeRequest("/auth/callback?code=abc123&next=https%3A%2F%2Fevil.com")
      );
      // Should ignore the unsafe next and fall back to /dashboard
      expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("rejects protocol-relative open-redirect attempts", async () => {
      const res = await GET(
        makeRequest("/auth/callback?code=abc123&next=%2F%2Fevil.com%2Fpath")
      );
      expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });
  });
});
