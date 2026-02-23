// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
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
  allUserNames: { "user-a": "Alice", "user-b": "Bob" },
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

  it("shows 'Everyone's settled up!' when there are no expenses", () => {
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[]} />);
    expect(screen.getByText(/everyone.*settled up/i)).toBeTruthy();
  });

  it("shows the correct debt amount when one member paid for all", () => {
    // Alice paid $10 split between Alice and Bob → Bob owes Alice $5
    const expense = makeExpense({ amountCents: 1000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    // $5.00 appears in both balances section and expense row stake
    expect(screen.getAllByText("$5.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'you' for the current user in the debt label", () => {
    // Bob paid $10 split between Alice and Bob → Alice owes Bob
    // currentUserId = user-a (Alice), so fromLabel = "You", toLabel = "Bob"
    const expense = makeExpense({ amountCents: 1000, paidById: "user-b", participantIds: ["user-a", "user-b"] });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    // "You owe Bob $5.00" — names appear as pills (multiple spans with same text)
    expect(screen.getAllByText("You").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
    // $5.00 appears in both balances section and expense row stake
    expect(screen.getAllByText("$5.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'settled up' when debts cancel out", () => {
    // Alice paid $10 for both, Bob paid $10 for both → net zero
    const exp1 = makeExpense({ id: "1", amountCents: 1000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    const exp2 = makeExpense({ id: "2", amountCents: 1000, paidById: "user-b", participantIds: ["user-a", "user-b"] });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[exp1, exp2]} />);
    expect(screen.getByText(/everyone.*settled up/i)).toBeTruthy();
  });

  it("updates balances when initialExpenses changes via rerender", () => {
    const { rerender } = render(<GroupInteractive {...BASE_PROPS} initialExpenses={[]} />);
    expect(screen.getByText(/everyone.*settled up/i)).toBeTruthy();

    const expense = makeExpense({ amountCents: 2000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    rerender(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);

    // Bob now owes Alice $10
    expect(screen.queryByText(/everyone.*settled up/i)).toBeNull();
    expect(screen.getByText("$10.00")).toBeTruthy();
  });
});

describe("GroupInteractive — Balances with departed members", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {}, error: null }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Carol (user-c) is a departed member: present in allUserNames but NOT in members.
  const PROPS_WITH_DEPARTED = {
    ...BASE_PROPS,
    allUserNames: { "user-a": "Alice", "user-b": "Bob", "user-c": "Carol" },
    // members intentionally omits Carol — she has left the group
  };

  it("shows departed payer's name (not 'Unknown') when current user owes them", () => {
    // Carol paid $10, split between Alice and Carol. Alice owes Carol $5.
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-c",
      paidByDisplayName: "Carol",
      participantIds: ["user-a", "user-c"],
    });
    render(<GroupInteractive {...PROPS_WITH_DEPARTED} initialExpenses={[expense]} />);
    expect(screen.getAllByText("Carol").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Unknown")).toHaveLength(0);
    // $5.00 appears in both balances section and expense row stake
    expect(screen.getAllByText("$5.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows departed debtor's name (not 'Unknown') when they owe the current user", () => {
    // Alice paid $10, split between Alice and Carol. Carol owes Alice $5.
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "user-c"],
    });
    render(<GroupInteractive {...PROPS_WITH_DEPARTED} initialExpenses={[expense]} />);
    expect(screen.getAllByText("Carol").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Unknown")).toHaveLength(0);
    // $5.00 appears in both balances section and expense row stake
    expect(screen.getAllByText("$5.00").length).toBeGreaterThanOrEqual(1);
  });

  it("resolves all names correctly when current and departed members share the same balance", () => {
    // Alice paid $30 split 3 ways: Bob owes $10, Carol owes $10
    const expense = makeExpense({
      amountCents: 3000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "user-b", "user-c"],
    });
    render(<GroupInteractive {...PROPS_WITH_DEPARTED} initialExpenses={[expense]} />);
    expect(screen.queryAllByText("Unknown")).toHaveLength(0);
    // Both current member (Bob) and departed member (Carol) appear by name
    expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Carol").length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to 'Unknown' only for a user with no name in allUserNames or members", () => {
    // ghost-user is not in allUserNames or members
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "ghost-user",
      paidByDisplayName: "Ghost",
      participantIds: ["user-a", "ghost-user"],
    });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(1);
  });
});
