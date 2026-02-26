import { describe, it, expect, vi, beforeEach } from "vitest";

const USER_ID = "a0000000-0000-4000-8000-000000000001";

const { mockRpc, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/groups/group-1/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const mockParams = Promise.resolve({ id: "group-1" });

describe("POST /api/groups/[id]/expenses — recurring date validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });

    // Mock .from() to handle both GroupMember and Expense queries
    mockFrom.mockImplementation((table: string) => {
      if (table === "GroupMember") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { userId: USER_ID, User: { displayName: "Alice" } },
                  { userId: "a0000000-0000-4000-8000-000000000002", User: { displayName: "Bob" } },
                ],
              }),
            }),
          }),
        };
      }
      // Expense table — for fetching created expense
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "expense-1", description: "Test" },
            }),
          }),
        }),
      };
    });

    mockRpc.mockResolvedValue({ data: "expense-1", error: null });
  });

  it("rejects recurring expense with date more than 3 months in the past", async () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 4);
    const dateStr = pastDate.toISOString().split("T")[0];

    const res = await POST(makeRequest({
      description: "Old recurring",
      amountCents: 1000,
      date: dateStr,
      recurring: { frequency: "monthly" },
    }), { params: mockParams });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("3 months in the past");
  });

  it("allows recurring expense with recent past date", async () => {
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);
    const dateStr = recentDate.toISOString().split("T")[0];

    const res = await POST(makeRequest({
      description: "Recent recurring",
      amountCents: 1000,
      date: dateStr,
      recurring: { frequency: "monthly" },
    }), { params: mockParams });

    expect(res.status).toBe(201);
  });

  it("allows non-recurring expense with old date", async () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 2);
    const dateStr = pastDate.toISOString().split("T")[0];

    const res = await POST(makeRequest({
      description: "Old expense",
      amountCents: 1000,
      date: dateStr,
    }), { params: mockParams });

    expect(res.status).toBe(201);
  });
});
