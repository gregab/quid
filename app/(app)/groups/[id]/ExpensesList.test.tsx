// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ExpensesList, type ExpenseRow } from "./ExpensesList";

// Without cleanup, rendered DOM accumulates across tests in the same file.
afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const BASE_PROPS = {
  groupId: "group-1",
  groupCreatedById: "creator-1",
  currentUserId: "user-1",
  currentUserDisplayName: "Alice",
  members: [{ userId: "user-1", displayName: "Alice" }],
};

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: "expense-1",
    description: "Dinner",
    amountCents: 2500,
    date: "2024-01-15",
    paidById: "user-1",
    paidByDisplayName: "Alice",
    participantIds: ["user-1"],
    canEdit: true,
    canDelete: true,
    ...overrides,
  };
}

// ----------------------------
// Bug 2: pending items hide edit/delete buttons entirely
// ----------------------------

describe("ExpensesList — edit/delete buttons on pending expenses", () => {
  it("shows edit and delete buttons when expense is NOT pending (baseline)", () => {
    render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ isPending: false })]} />
    );
    // getByRole throws if absent — that IS the assertion
    screen.getByRole("button", { name: /edit expense/i });
    screen.getByRole("button", { name: /delete expense/i });
  });

  it("shows edit and delete buttons even when expense IS pending", () => {
    // Bug: `{!expense.isPending && <ExpenseActions />}` hides buttons entirely.
    // Expected: buttons rendered (but disabled) so the card layout is consistent.
    render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ isPending: true })]} />
    );
    const editBtn = screen.queryByRole("button", { name: /edit expense/i });
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i });
    expect(editBtn, "edit button should be in the DOM even while pending").not.toBeNull();
    expect(deleteBtn, "delete button should be in the DOM even while pending").not.toBeNull();
  });

  it("disables edit and delete buttons while expense is pending", () => {
    render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ isPending: true })]} />
    );
    const editBtn = screen.queryByRole("button", { name: /edit expense/i }) as HTMLButtonElement | null;
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i }) as HTMLButtonElement | null;
    // Existence is a prerequisite — if these fail, fix Bug 2 first
    expect(editBtn, "edit button must exist before checking disabled").not.toBeNull();
    expect(deleteBtn, "delete button must exist before checking disabled").not.toBeNull();
    expect(editBtn!.disabled, "edit button should be disabled while pending").toBe(true);
    expect(deleteBtn!.disabled, "delete button should be disabled while pending").toBe(true);
  });

  it("enables edit and delete buttons once expense is no longer pending", () => {
    render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ isPending: false })]} />
    );
    const editBtn = screen.getByRole("button", { name: /edit expense/i }) as HTMLButtonElement;
    const deleteBtn = screen.getByRole("button", { name: /delete expense/i }) as HTMLButtonElement;
    expect(editBtn.disabled).toBe(false);
    expect(deleteBtn.disabled).toBe(false);
  });
});

// ----------------------------
// Bug 1: pending item never replaced after router.refresh()
// ----------------------------

describe("ExpensesList — optimistic add: pending item resolved after prop update", () => {
  it("replaces pending item with real item when initialExpenses prop updates", () => {
    // When the server re-renders (via router.refresh()), ExpensesList receives fresh
    // initialExpenses. Because useState(initialExpenses) ignores subsequent prop changes,
    // the pending ghost stays in the list forever.
    const pending = makeExpense({ id: "pending-1", isPending: true });
    const real = makeExpense({ id: "real-1", isPending: false });

    const { rerender } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[pending]} />
    );

    // Simulate router.refresh() delivering real server data
    rerender(<ExpensesList {...BASE_PROPS} initialExpenses={[real]} />);

    // The edit button must be present AND enabled — only true if the real item replaced
    // the pending one. (This test requires Bug 2 to be fixed first.)
    const editBtn = screen.queryByRole("button", { name: /edit expense/i }) as HTMLButtonElement | null;
    expect(editBtn, "edit button must exist after real item arrives").not.toBeNull();
    expect(editBtn!.disabled, "edit button should be enabled once item is no longer pending").toBe(false);
  });

  it("does not show both the pending ghost and the real expense simultaneously", () => {
    const pending = makeExpense({ id: "pending-1", isPending: true, description: "Lunch" });
    const real = makeExpense({ id: "real-1", isPending: false, description: "Lunch" });

    const { rerender } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[pending]} />
    );

    rerender(<ExpensesList {...BASE_PROPS} initialExpenses={[real]} />);

    // Should see exactly one "Lunch" description, not both the ghost and the real item
    expect(screen.getAllByText("Lunch")).toHaveLength(1);
  });

  it("preserves non-pending expenses while resolving a pending one", () => {
    const existing = makeExpense({ id: "old-1", description: "Old expense", isPending: false });
    const pending = makeExpense({ id: "pending-1", description: "New expense", isPending: true });
    const realNew = makeExpense({ id: "real-1", description: "New expense", isPending: false });

    const { rerender } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[pending, existing]} />
    );

    rerender(<ExpensesList {...BASE_PROPS} initialExpenses={[realNew, existing]} />);

    expect(screen.getAllByText("Old expense")).toHaveLength(1);
    expect(screen.getAllByText("New expense")).toHaveLength(1);
  });
});
