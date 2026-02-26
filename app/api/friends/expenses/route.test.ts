import { describe, it, expect, vi, beforeEach } from "vitest";

// Use proper UUID v4 format for test data
const USER_ID = "a0000000-0000-4000-8000-000000000001";
const FRIEND_1 = "a0000000-0000-4000-8000-000000000002";
const FRIEND_2 = "a0000000-0000-4000-8000-000000000003";
const FRIEND_3 = "a0000000-0000-4000-8000-000000000004";

// Mock Supabase client
const mockRpc = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: USER_ID } },
      })),
    },
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  })),
}));

// Dynamically import after mocks are set up
const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/friends/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/friends/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: profile lookups return display names
    mockSingle.mockResolvedValue({
      data: { displayName: "Alice" },
      error: null,
    });
    // Default: RPCs succeed
    mockRpc.mockResolvedValue({ data: "group-1", error: null });
  });

  it("returns 400 when friendIds is empty", async () => {
    const res = await POST(makeRequest({
      friendIds: [],
      description: "Dinner",
      amountCents: 3000,
      date: "2026-02-25",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    const res = await POST(makeRequest({
      friendIds: [FRIEND_1],
      description: "",
      amountCents: 3000,
      date: "2026-02-25",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when paidById is invalid (not self or single friend)", async () => {
    const res = await POST(makeRequest({
      friendIds: [FRIEND_1, FRIEND_2],
      description: "Dinner",
      amountCents: 3000,
      date: "2026-02-25",
      paidById: FRIEND_1, // can't select a friend payer when >1 friend
    }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Invalid payer");
  });

  it("returns 400 when friendIds includes self", async () => {
    const res = await POST(makeRequest({
      friendIds: [USER_ID],
      description: "Dinner",
      amountCents: 3000,
      date: "2026-02-25",
    }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Cannot add an expense with yourself");
  });

  it("creates expense for 1 friend with correct split math", async () => {
    const res = await POST(makeRequest({
      friendIds: [FRIEND_1],
      description: "Lunch",
      amountCents: 3000,
      date: "2026-02-25",
    }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { createdCount: number } };
    expect(json.data.createdCount).toBe(1);

    // Check get_or_create_friend_group was called
    const friendGroupCall = mockRpc.mock.calls.find(
      (c: unknown[]) => c[0] === "get_or_create_friend_group",
    );
    expect(friendGroupCall).toBeDefined();

    // Check create_expense was called with correct splits
    // $30 / 2 people = $15 each → myShare=1500, friendShare=1500
    const createExpenseCall = mockRpc.mock.calls.find(
      (c: unknown[]) => c[0] === "create_expense",
    );
    expect(createExpenseCall).toBeDefined();
    const params = createExpenseCall![1] as Record<string, unknown>;
    expect(params._amount_cents).toBe(3000);
    expect(params._split_amounts).toEqual([1500, 1500]);
    expect(params._split_type).toBe("custom");
    expect(params._paid_by_id).toBe(USER_ID);
  });

  it("creates expenses for 3 friends with correct split math", async () => {
    // Alternate between friend group and expense RPCs
    mockRpc
      .mockResolvedValueOnce({ data: "group-1", error: null }) // get_or_create_friend_group
      .mockResolvedValueOnce({ data: "exp-1", error: null }) // create_expense
      .mockResolvedValueOnce({ data: "group-2", error: null })
      .mockResolvedValueOnce({ data: "exp-2", error: null })
      .mockResolvedValueOnce({ data: "group-3", error: null })
      .mockResolvedValueOnce({ data: "exp-3", error: null });

    const res = await POST(makeRequest({
      friendIds: [FRIEND_1, FRIEND_2, FRIEND_3],
      description: "Dinner",
      amountCents: 3001, // $30.01 among 4 = [751, 750, 750, 750]
      date: "2026-02-25",
    }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { createdCount: number } };
    expect(json.data.createdCount).toBe(3);

    // 3 friends → 3 create_expense calls
    const createCalls = mockRpc.mock.calls.filter(
      (c: unknown[]) => c[0] === "create_expense",
    );
    expect(createCalls.length).toBe(3);

    // splitAmount(3001, 4) = [751, 750, 750, 750]
    // index 0 = user's share (751), indices 1,2,3 = friend shares (750 each)
    // Each friend group: myShare = 3001 - friendShare, friendShare
    const p1 = createCalls[0]![1] as Record<string, unknown>;
    expect(p1._split_amounts).toEqual([2251, 750]);

    const p2 = createCalls[1]![1] as Record<string, unknown>;
    expect(p2._split_amounts).toEqual([2251, 750]);

    const p3 = createCalls[2]![1] as Record<string, unknown>;
    expect(p3._split_amounts).toEqual([2251, 750]);
  });

  it("allows friend as payer when exactly 1 friend selected", async () => {
    const res = await POST(makeRequest({
      friendIds: [FRIEND_1],
      description: "Coffee",
      amountCents: 600,
      date: "2026-02-25",
      paidById: FRIEND_1,
    }));

    expect(res.status).toBe(200);
    const createCall = mockRpc.mock.calls.find(
      (c: unknown[]) => c[0] === "create_expense",
    );
    const params = createCall![1] as Record<string, unknown>;
    expect(params._paid_by_id).toBe(FRIEND_1);
  });
});
