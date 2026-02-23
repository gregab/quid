import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "./route";

// ---------------------------------------------------------------------------
// Mocks
// vi.mock factories are hoisted to the top of the file, so variables they
// reference must be declared with vi.hoisted() to be available in time.
// ---------------------------------------------------------------------------

const { mockRpc, mockGetUser, mockDeleteUser } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
  mockDeleteUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { deleteUser: mockDeleteUser } },
  }),
}));

const mockUser = { id: "user-123", email: "test@example.com" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockRpc.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE();

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 500 when delete_account RPC fails (e.g. FK constraint violation)", async () => {
    // This is the exact failure mode that was happening before the SQL fix:
    // the User row couldn't be deleted because Expense.paidById still referenced it.
    mockRpc.mockResolvedValue({
      error: {
        message:
          'update or delete on table "User" violates foreign key constraint "Expense_paidById_fkey" on table "Expense"',
      },
    });

    const res = await DELETE();

    expect(res.status).toBe(500);
    const body = await res.json() as { data: null; error: string };
    expect(body.data).toBeNull();
    expect(body.error).toBeDefined();
  });

  it("returns 500 with settle-up message when user has outstanding debts", async () => {
    mockRpc.mockResolvedValue({
      error: {
        message:
          "Cannot delete account: you have outstanding debts. Please settle up first.",
      },
    });

    const res = await DELETE();

    expect(res.status).toBe(500);
    const body = await res.json() as { data: null; error: string };
    expect(body.error).toMatch(/settle up/i);
  });

  it("returns 500 when auth admin deleteUser fails", async () => {
    mockDeleteUser.mockResolvedValue({
      error: { message: "Admin delete failed" },
    });

    const res = await DELETE();

    expect(res.status).toBe(500);
    const body = await res.json() as { data: null; error: string };
    expect(body.error).toBe("Admin delete failed");
  });

  it("returns 200 with deleted: true on success", async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { deleted: boolean }; error: null };
    expect(body.data).toEqual({ deleted: true });
    expect(body.error).toBeNull();
  });

  it("calls delete_account RPC before admin deleteUser", async () => {
    const callOrder: string[] = [];
    mockRpc.mockImplementation(() => {
      callOrder.push("rpc");
      return Promise.resolve({ error: null });
    });
    mockDeleteUser.mockImplementation(() => {
      callOrder.push("admin");
      return Promise.resolve({ error: null });
    });

    await DELETE();

    expect(callOrder).toEqual(["rpc", "admin"]);
  });
});
