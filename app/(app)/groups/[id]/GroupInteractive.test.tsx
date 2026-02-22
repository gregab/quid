// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GroupInteractive } from "./GroupInteractive";
import type { ExpenseRow } from "./ExpensesList";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const MEMBERS = [
  { userId: "user-a", displayName: "Alice" },
  { userId: "user-b", displayName: "Bob" },
];

const BASE_PROPS = {
  groupId: "group-1",
  groupCreatedById: "user-a",
  currentUserId: "user-a",
  currentUserDisplayName: "Alice",
  initialLogs: [],
  members: MEMBERS,
};

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: "expense-1",
    description: "Dinner",
    amountCents: 1000,
    date: "2024-01-15",
    paidById: "user-a",
    paidByDisplayName: "Alice",
    participantIds: ["user-a", "user-b"],
    canEdit: true,
    canDelete: true,
    ...overrides,
  };
}

describe("GroupInteractive — Balances section", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {}, error: null }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 'All perched even!' when there are no expenses", () => {
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[]} />);
    expect(screen.getByText(/all perched even/i)).toBeTruthy();
  });

  it("shows the correct debt amount when one member paid for all", () => {
    // Alice paid $10 split between Alice and Bob → Bob owes Alice $5
    const expense = makeExpense({ amountCents: 1000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(screen.getByText("$5.00")).toBeTruthy();
  });

  it("shows 'you' for the current user in the debt label", () => {
    // Bob paid $10 split between Alice and Bob → Alice owes Bob
    // currentUserId = user-a (Alice), so fromLabel = "You", toLabel = "Bob"
    const expense = makeExpense({ amountCents: 1000, paidById: "user-b", participantIds: ["user-a", "user-b"] });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    // "You owe Bob $5.00"
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("$5.00")).toBeTruthy();
  });

  it("shows 'All perched even!' when debts cancel out", () => {
    // Alice paid $10 for both, Bob paid $10 for both → net zero
    const exp1 = makeExpense({ id: "1", amountCents: 1000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    const exp2 = makeExpense({ id: "2", amountCents: 1000, paidById: "user-b", participantIds: ["user-a", "user-b"] });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[exp1, exp2]} />);
    expect(screen.getByText(/all perched even/i)).toBeTruthy();
  });

  it("updates balances when initialExpenses changes via rerender", () => {
    const { rerender } = render(<GroupInteractive {...BASE_PROPS} initialExpenses={[]} />);
    expect(screen.getByText(/all perched even/i)).toBeTruthy();

    const expense = makeExpense({ amountCents: 2000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    rerender(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);

    // Bob now owes Alice $10
    expect(screen.queryByText(/all perched even/i)).toBeNull();
    expect(screen.getByText("$10.00")).toBeTruthy();
  });
});
