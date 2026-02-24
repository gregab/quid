// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
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
  hasMoreLogs: false,
  members: MEMBERS,
  allUserNames: { "user-a": "Alice", "user-b": "Bob" },
  inviteToken: "test-invite-token",
};

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  const participantIds = overrides.participantIds ?? ["user-a", "user-b"];
  const amountCents = overrides.amountCents ?? 1000;
  const defaultSplits = participantIds.map((id, i) => ({
    userId: id,
    amountCents: Math.floor(amountCents / participantIds.length) + (i < amountCents % participantIds.length ? 1 : 0),
  }));
  return {
    id: "expense-1",
    description: "Dinner",
    amountCents,
    date: "2024-01-15",
    paidById: "user-a",
    paidByDisplayName: "Alice",
    participantIds,
    splits: defaultSplits,
    splitType: "equal",
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
    expect(screen.getByText(/all settled up/i)).toBeTruthy();
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
    expect(screen.getByText(/all settled up/i)).toBeTruthy();
  });

  it("updates balances when initialExpenses changes via rerender", () => {
    const { rerender } = render(<GroupInteractive {...BASE_PROPS} initialExpenses={[]} />);
    expect(screen.getByText(/all settled up/i)).toBeTruthy();

    const expense = makeExpense({ amountCents: 2000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    rerender(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);

    // Bob now owes Alice $10 — appears in balances section and expense row
    expect(screen.queryByText(/everyone.*settled up/i)).toBeNull();
    expect(screen.getAllByText("$10.00").length).toBeGreaterThanOrEqual(1);
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

describe("GroupInteractive — Balances with custom (uneven) splits", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {}, error: null }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses stored split amounts for balance computation (not equal re-derivation)", () => {
    // $100 expense: Alice paid, Bob owes $60, Alice owes $40 (custom split)
    const expense = makeExpense({
      amountCents: 10000,
      paidById: "user-a",
      splitType: "custom",
      participantIds: ["user-a", "user-b"],
      splits: [
        { userId: "user-a", amountCents: 4000 },
        { userId: "user-b", amountCents: 6000 },
      ],
    });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    // Bob owes Alice $60, not $50
    expect(screen.getAllByText("$60.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows settled up when custom splits cancel out", () => {
    // Alice paid $100, Bob owes $60 (custom), Alice owes $40
    // Bob pays $60 back to Alice (all $60 is Alice's share) → net zero
    const exp1 = makeExpense({
      id: "1",
      amountCents: 10000,
      paidById: "user-a",
      splitType: "custom",
      participantIds: ["user-a", "user-b"],
      splits: [
        { userId: "user-a", amountCents: 4000 },
        { userId: "user-b", amountCents: 6000 },
      ],
    });
    // Bob paid $60, only Alice participates → Alice owes Bob $60 (cancels exp1)
    const exp2 = makeExpense({
      id: "2",
      amountCents: 6000,
      paidById: "user-b",
      splitType: "custom",
      participantIds: ["user-a"],
      splits: [{ userId: "user-a", amountCents: 6000 }],
    });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[exp1, exp2]} />);
    expect(screen.getByText(/all settled up/i)).toBeTruthy();
  });
});

// ─── Deleted account — balance correctness ──────────────────────────────────

describe("GroupInteractive — deleted account balance integrity", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {}, error: null }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 'Unknown' when deleted user ID is absent from allUserNames entirely", () => {
    // A user deleted their account and their User row is gone.
    // The page.tsx User join returns null, so their ID isn't in allUserNames.
    const expense = makeExpense({
      amountCents: 4000,
      paidById: "deleted-xyz",
      paidByDisplayName: "Unknown",
      participantIds: ["user-a", "deleted-xyz"],
    });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(1);
  });

  it("preserves deleted user name when allUserNames was populated from expense joins", () => {
    // In practice, page.tsx builds allUserNames from expense.User joins.
    // If the User row still exists (or was captured before deletion), the name persists.
    const expense = makeExpense({
      amountCents: 6000,
      paidById: "deleted-xyz",
      paidByDisplayName: "Dave",
      participantIds: ["user-a", "deleted-xyz"],
    });
    render(
      <GroupInteractive
        {...BASE_PROPS}
        allUserNames={{ "user-a": "Alice", "user-b": "Bob", "deleted-xyz": "Dave" }}
        initialExpenses={[expense]}
      />
    );
    expect(screen.getAllByText("Dave").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Unknown")).toHaveLength(0);
  });

  it("balance amount is correct with a deleted user as payer", () => {
    // Deleted Dave paid $80 split equally with Alice (current user)
    // Alice owes Dave $40
    const expense = makeExpense({
      amountCents: 8000,
      paidById: "deleted-xyz",
      paidByDisplayName: "Dave",
      participantIds: ["user-a", "deleted-xyz"],
    });
    render(
      <GroupInteractive
        {...BASE_PROPS}
        allUserNames={{ "user-a": "Alice", "user-b": "Bob", "deleted-xyz": "Dave" }}
        initialExpenses={[expense]}
      />
    );
    expect(screen.getByText("You")).toBeDefined();
    expect(screen.getByText("owe")).toBeDefined();
    expect(screen.getByText("Dave")).toBeDefined();
    expect(screen.getAllByText("$40.00").length).toBeGreaterThanOrEqual(1);
  });

  it("balance amount is correct with a deleted user as debtor", () => {
    // Alice (current user) paid $80 split equally with deleted Dave
    // Dave owes Alice $40
    const expense = makeExpense({
      amountCents: 8000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "deleted-xyz"],
    });
    render(
      <GroupInteractive
        {...BASE_PROPS}
        allUserNames={{ "user-a": "Alice", "user-b": "Bob", "deleted-xyz": "Dave" }}
        initialExpenses={[expense]}
      />
    );
    expect(screen.getByText("Dave")).toBeDefined();
    expect(screen.getByText("you")).toBeDefined();
    expect(screen.getAllByText("$40.00").length).toBeGreaterThanOrEqual(1);
  });

  it("multiple departed/deleted users render distinct names in balances", () => {
    // Alice paid $90 split 3 ways with Carol (left) and Dave (deleted)
    const expense = makeExpense({
      amountCents: 9000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "user-c", "deleted-xyz"],
    });
    render(
      <GroupInteractive
        {...BASE_PROPS}
        allUserNames={{
          "user-a": "Alice",
          "user-b": "Bob",
          "user-c": "Carol",
          "deleted-xyz": "Dave",
        }}
        initialExpenses={[expense]}
      />
    );
    expect(screen.getAllByText("Carol").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dave").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Unknown")).toHaveLength(0);
  });

  it("settled-up state with departed members shows no debts", () => {
    // Carol (departed) paid $60 split 2 ways with Alice, then Alice paid $60 split 2 ways with Carol
    // Net zero
    const exp1 = makeExpense({
      id: "exp-1",
      amountCents: 6000,
      paidById: "user-c",
      paidByDisplayName: "Carol",
      participantIds: ["user-a", "user-c"],
    });
    const exp2 = makeExpense({
      id: "exp-2",
      amountCents: 6000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "user-c"],
    });
    render(
      <GroupInteractive
        {...BASE_PROPS}
        allUserNames={{ "user-a": "Alice", "user-b": "Bob", "user-c": "Carol" }}
        initialExpenses={[exp1, exp2]}
      />
    );
    expect(screen.getByText(/all settled up/i)).toBeTruthy();
  });
});

// ─── New balance UI: sort, highlight, user-settled-up state ──────────────────

describe("GroupInteractive — balance UI improvements", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {}, error: null }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const THREE_MEMBER_PROPS = {
    ...BASE_PROPS,
    members: [
      { userId: "user-a", displayName: "Alice" },
      { userId: "user-b", displayName: "Bob" },
      { userId: "user-c", displayName: "Carol" },
    ],
    allUserNames: { "user-a": "Alice", "user-b": "Bob", "user-c": "Carol" },
  };

  it("shows \"You're all settled up!\" when current user has no debts but others do", () => {
    // Bob paid $10 for Carol only — Alice (current user) is uninvolved
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-c"],
      splits: [{ userId: "user-c", amountCents: 1000 }],
    });
    render(<GroupInteractive {...THREE_MEMBER_PROPS} initialExpenses={[expense]} />);
    expect(screen.getByText(/you're all settled up/i)).toBeTruthy();
    // The other debt (Carol owes Bob) is still shown
    expect(screen.getAllByText("Carol").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show \"You're all settled up!\" when current user has an outstanding debt", () => {
    // Bob paid $10 split with Alice — Alice owes Bob
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    render(<GroupInteractive {...THREE_MEMBER_PROPS} initialExpenses={[expense]} />);
    expect(screen.queryByText(/you're all settled up/i)).toBeNull();
  });

  it("does not show \"You're all settled up!\" when there are no debts at all", () => {
    render(<GroupInteractive {...THREE_MEMBER_PROPS} initialExpenses={[]} />);
    expect(screen.queryByText(/you're all settled up/i)).toBeNull();
    // The "everyone" message appears instead
    expect(screen.getByText(/all settled up/i)).toBeTruthy();
  });

  it("current user's debt appears before debts not involving them", () => {
    // Two debts: Alice owes Bob $5 (involves user), Carol owes Bob $5 (does not)
    const aliceOwesBob = makeExpense({
      id: "e1",
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    const carolOwesBob = makeExpense({
      id: "e2",
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-c", "user-b"],
    });
    // Pass Carol's expense first — sorting should still put Alice (You) first
    const { container } = render(
      <GroupInteractive {...THREE_MEMBER_PROPS} initialExpenses={[carolOwesBob, aliceOwesBob]} />
    );
    // The balances are inline text; "You" should appear before "Carol" in the text content
    const balancesText = container.textContent ?? "";
    const youPos = balancesText.indexOf("You owe");
    const carolPos = balancesText.indexOf("Carol owes");
    expect(youPos).toBeGreaterThanOrEqual(0);
    expect(carolPos).toBeGreaterThanOrEqual(0);
    expect(youPos).toBeLessThan(carolPos);
  });

  it("colors amount red when current user owes money", () => {
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    const { container } = render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(container.querySelector("[class*='text-red-']")).not.toBeNull();
  });

  it("colors amount green when current user is owed money", () => {
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "user-b"],
    });
    const { container } = render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(container.querySelector("[class*='text-emerald-']")).not.toBeNull();
  });

  it("renders each debt phrase as a separate flex item (no · separator characters)", () => {
    const aliceOwesBob = makeExpense({
      id: "e1",
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    const carolOwesBob = makeExpense({
      id: "e2",
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-c", "user-b"],
    });
    const { container } = render(
      <GroupInteractive {...THREE_MEMBER_PROPS} initialExpenses={[aliceOwesBob, carolOwesBob]} />
    );
    // No · separator characters — items are separated by flex gap instead
    const dotSeparators = Array.from(container.querySelectorAll("span")).filter(
      (el) => el.textContent?.trim() === "·"
    );
    expect(dotSeparators.length).toBe(0);
    // No <wbr> elements either
    expect(container.querySelectorAll("wbr").length).toBe(0);
    // Both debt phrases are present
    expect(container.textContent).toContain("You owe");
    expect(container.textContent).toContain("Carol owes");
  });

  it("uses lowercase 'you' when current user is the recipient", () => {
    // Alice paid $10 split with Bob — Bob owes Alice (current user)
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "user-b"],
    });
    const { container } = render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    // "Bob owes you $5.00" — lowercase "you"
    expect(container.textContent).toContain("owes you");
  });

  it("uses capitalized 'You' when current user owes money", () => {
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    const { container } = render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    // "You owe Bob $5.00" — capitalized "You"
    expect(container.textContent).toContain("You owe");
  });

  it("renders no Balances heading or card wrapper", () => {
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    render(<GroupInteractive {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(screen.queryByText("Balances")).toBeNull();
  });

  it("shows user debts by default and hides third-party debts behind toggle", () => {
    const aliceOwesBob = makeExpense({
      id: "e1",
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    const carolOwesBob = makeExpense({
      id: "e2",
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-c", "user-b"],
    });
    const { container } = render(
      <GroupInteractive {...THREE_MEMBER_PROPS} initialExpenses={[aliceOwesBob, carolOwesBob]} />
    );
    // User's debt is visible
    expect(container.textContent).toContain("You owe");
    expect(container.textContent).toContain("$5.00");
    // Third-party debt exists but is in a collapsed container
    const expandContainer = container.querySelector(".debt-expand");
    expect(expandContainer).not.toBeNull();
    expect(expandContainer!.classList.contains("open")).toBe(false);
    // Toggle button shows count
    const toggleBtn = screen.getByText(/Show all balances/);
    expect(toggleBtn.textContent).toContain("1 more");
    // Click to expand
    fireEvent.click(toggleBtn);
    expect(expandContainer!.classList.contains("open")).toBe(true);
    expect(container.textContent).toContain("Carol");
    // Click to collapse
    fireEvent.click(screen.getByText("Show less"));
    expect(expandContainer!.classList.contains("open")).toBe(false);
  });
});

// ─── Settle Up: userOwesDebts integration ────────────────────────────────────
//
// These tests verify that GroupInteractive computes `userOwesDebts` correctly
// from the expense state and passes it to RecordPaymentForm, so the Settle Up
// modal shows the right people and amounts.

describe("GroupInteractive — Settle Up modal shows correct debts", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function openSettleUpModal() {
    // ExpensesList renders the button twice (desktop + mobile); click the first.
    const buttons = screen.getAllByRole("button", { name: /settle up/i });
    fireEvent.click(buttons[0]!);
  }

  it("shows Bob in the Settle Up modal when Alice owes Bob money", () => {
    // Bob paid $10 split with Alice → Alice owes Bob $5
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-b",
      paidByDisplayName: "Bob",
      participantIds: ["user-a", "user-b"],
    });
    render(<GroupInteractive {...BASE_PROPS} hasMoreLogs={false} initialExpenses={[expense]} />);
    openSettleUpModal();
    // Scope to the modal so we don't collide with Bob appearing in the Balances section
    const modal = document.querySelector(".modal-content") as HTMLElement;
    expect(within(modal).getByText("Bob")).toBeTruthy();
    expect(within(modal).getByText("$5.00")).toBeTruthy();
  });

  it("shows settled-up message when Alice is not in debt (she is owed money)", () => {
    // Alice paid $10 split with Bob → Bob owes Alice, not the other way
    const expense = makeExpense({
      amountCents: 1000,
      paidById: "user-a",
      paidByDisplayName: "Alice",
      participantIds: ["user-a", "user-b"],
    });
    render(<GroupInteractive {...BASE_PROPS} hasMoreLogs={false} initialExpenses={[expense]} />);
    openSettleUpModal();
    // Scope to the modal — Bob appears in the Balances section but NOT as a debt row in the modal
    const modal = document.querySelector(".modal-content") as HTMLElement;
    expect(within(modal).getByText(/you're all settled up/i)).toBeTruthy();
    expect(within(modal).queryByText("Bob")).toBeNull();
  });

  it("shows settled-up message when no expenses exist", () => {
    render(<GroupInteractive {...BASE_PROPS} hasMoreLogs={false} initialExpenses={[]} />);
    openSettleUpModal();
    expect(screen.getByText(/you're all settled up/i)).toBeTruthy();
  });

  it("shows settled-up message when debts cancel out", () => {
    // Alice paid $10 for both, Bob paid $10 for both → net zero
    const exp1 = makeExpense({ id: "1", amountCents: 1000, paidById: "user-a", participantIds: ["user-a", "user-b"] });
    const exp2 = makeExpense({ id: "2", amountCents: 1000, paidById: "user-b", participantIds: ["user-a", "user-b"] });
    render(<GroupInteractive {...BASE_PROPS} hasMoreLogs={false} initialExpenses={[exp1, exp2]} />);
    openSettleUpModal();
    expect(screen.getByText(/you're all settled up/i)).toBeTruthy();
  });
});
