import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    rpc: mockRpc,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = authHeader
    ? { authorization: authHeader }
    : {};
  return new NextRequest("http://localhost/api/cron/process-recurring", {
    method: "POST",
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/cron/process-recurring", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, CRON_SECRET: "test-secret-123" };
    mockRpc.mockResolvedValue({ data: 3, error: null });
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header has wrong secret", async () => {
    const res = await POST(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeRequest("Bearer test-secret-123"));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/CRON_SECRET/i);
  });

  it("calls process_due_recurring_expenses RPC with valid secret and returns count", async () => {
    const res = await POST(makeRequest("Bearer test-secret-123"));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { processed: number }; error: null };
    expect(body.data.processed).toBe(3);
    expect(mockRpc).toHaveBeenCalledWith("process_due_recurring_expenses");
  });

  it("returns 500 when RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const res = await POST(makeRequest("Bearer test-secret-123"));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("DB error");
  });
});
