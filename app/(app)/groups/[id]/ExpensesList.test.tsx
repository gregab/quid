// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
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
  members: [
    { userId: "user-1", displayName: "Alice" },
    { userId: "user-2", displayName: "Bob" },
  ],
  allUserNames: {
    "user-1": "Alice",
    "user-2": "Bob",
  },
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

// ----------------------------
// Auto-reorder on date edit
// ----------------------------

describe("ExpensesList — auto-reorder when expense date is edited", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {}, error: null }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves an expense to the end when its date is changed to be older than others", async () => {
    const newer = makeExpense({ id: "exp-b", description: "Newer", date: "2024-01-20", amountCents: 2000 });
    const older = makeExpense({ id: "exp-a", description: "Older", date: "2024-01-10", amountCents: 1000 });

    // Server delivers newest-first: [Newer, Older]
    const { container } = render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[newer, older]}
        onOptimisticActivity={vi.fn()}
      />
    );

    // Verify initial order
    let items = container.querySelectorAll("li");
    expect(items[0]!.textContent).toContain("Newer");
    expect(items[1]!.textContent).toContain("Older");

    // Open edit modal for "Newer" (first edit button)
    const editButtons = screen.getAllByRole("button", { name: /edit expense/i });
    fireEvent.click(editButtons[0]!);

    // Change its date to be earlier than "Older"
    const dateInput = screen.getByLabelText("Date");
    fireEvent.change(dateInput, { target: { value: "2024-01-05" } });

    // Submit via the form (fireEvent.click on a submit button doesn't trigger onSubmit in happy-dom)
    const form = screen.getByRole("button", { name: /save changes/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    // "Older" (2024-01-10) now has the newer date, so it goes first
    items = container.querySelectorAll("li");
    expect(items[0]!.textContent).toContain("Older");
    expect(items[1]!.textContent).toContain("Newer");
  });

  it("keeps the list order when the edited date stays more recent than others", async () => {
    const newer = makeExpense({ id: "exp-b", description: "Newer", date: "2024-01-20", amountCents: 2000 });
    const older = makeExpense({ id: "exp-a", description: "Older", date: "2024-01-10", amountCents: 1000 });

    const { container } = render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[newer, older]}
        onOptimisticActivity={vi.fn()}
      />
    );

    // Edit "Newer" but give it an even more recent date — order should not change
    const editButtons = screen.getAllByRole("button", { name: /edit expense/i });
    fireEvent.click(editButtons[0]!);

    const dateInput = screen.getByLabelText("Date");
    fireEvent.change(dateInput, { target: { value: "2024-01-25" } });

    const form2 = screen.getByRole("button", { name: /save changes/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form2);
    });

    const items = container.querySelectorAll("li");
    expect(items[0]!.textContent).toContain("Newer");
    expect(items[1]!.textContent).toContain("Older");
  });
});

// ----------------------------
// Payment card rendering
// ----------------------------

describe("ExpensesList — payment card rendering", () => {
  function makePayment(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
    return {
      id: "payment-1",
      description: "Payment",
      amountCents: 5000,
      date: "2024-03-01",
      paidById: "user-1",
      paidByDisplayName: "Alice",
      participantIds: ["user-2"],
      canEdit: false,
      canDelete: true,
      isPayment: true,
      createdById: "user-1",
      ...overrides,
    };
  }

  it("renders the Payment badge for payment rows", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[makePayment()]} />);
    expect(screen.getByText("Payment")).toBeDefined();
  });

  it("renders payment direction from the current user's perspective", () => {
    // makePayment() has paidById: "user-1" (Alice = currentUser) → participantIds: ["user-2"] (Bob)
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[makePayment()]} />);
    // Current user is sender, so shows "you paid Bob" rather than "Alice → Bob"
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you paid");
    expect(list?.textContent).toContain("Bob");
  });

  it("renders '[Name] → [Name]' for payments between other users", () => {
    // Neither payer nor recipient is the current user
    const payment = makePayment({ paidById: "user-2", participantIds: ["user-3"], createdById: "user-2" });
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "user-3": "Charlie" }}
        members={[
          { userId: "user-1", displayName: "Alice" },
          { userId: "user-2", displayName: "Bob" },
          { userId: "user-3", displayName: "Charlie" },
        ]}
        initialExpenses={[payment]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Bob");
    expect(list?.textContent).toContain("Charlie");
    expect(list?.textContent).toContain("→");
  });

  it("renders amount in indigo for payments", () => {
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makePayment()]} />
    );
    const amountEl = container.querySelector(".text-indigo-700.font-bold");
    expect(amountEl, "amount should have indigo color class").not.toBeNull();
    expect(amountEl!.textContent).toContain("$50.00");
  });

  it("does NOT render edit button for payment rows", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[makePayment()]} />);
    const editBtn = screen.queryByRole("button", { name: /edit expense/i });
    expect(editBtn, "payments should not have an edit button").toBeNull();
  });

  it("renders delete button for payments the current user created", () => {
    render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[makePayment({ canDelete: true })]}
      />
    );
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i });
    expect(deleteBtn, "creator should see delete button").not.toBeNull();
  });

  it("does not render delete button for payments the current user did not create", () => {
    render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[makePayment({ canDelete: false, createdById: "user-2" })]}
      />
    );
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i });
    expect(deleteBtn, "non-creator should not see delete button").toBeNull();
  });

  it("renders regular expense description for non-payment rows", () => {
    const regularExpense = makeExpense({ description: "Dinner" });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[regularExpense]} />);
    expect(screen.getByText("Dinner")).toBeDefined();
    // Should NOT render Payment badge
    expect(screen.queryByText("Payment")).toBeNull();
  });
});

// ----------------------------
// Expense row display
// ----------------------------

describe("ExpensesList — expense row display", () => {
  it("shows payer info and personal stake for a regular expense", () => {
    // paidById: user-2 (Bob), participantIds: [user-1 (Alice), user-2 (Bob)], currentUser: user-1
    const expense = makeExpense({ paidById: "user-2", participantIds: ["user-1", "user-2"], amountCents: 2000 });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    const list = document.querySelector("ul");
    // Secondary line: "[payer] paid $X"
    expect(list?.textContent).toContain("Bob paid");
    expect(list?.textContent).toContain("$20.00");
    // Personal stake: current user owes their share
    expect(list?.textContent).toContain("you owe");
  });

  it("does not show a comma-separated participant list on expense rows", () => {
    const expense = makeExpense({ participantIds: ["user-1", "user-2"] });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    // Participant names are not listed on the row
    expect(screen.queryByText("Alice, Bob")).toBeNull();
  });

  it("shows 'you paid' when current user is the payer", () => {
    // paidById: user-1 (Alice = currentUser)
    const expense = makeExpense({ paidById: "user-1", participantIds: ["user-1", "user-2"], amountCents: 2000 });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you paid");
    // Personal stake: Alice lent Bob's share
    expect(list?.textContent).toContain("you lent");
  });

  it("shows 'you lent' when current user paid and others owe them", () => {
    const expense = makeExpense({ paidById: "user-1", participantIds: ["user-1", "user-2"], amountCents: 2000 });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you lent");
  });

  it("shows no personal stake when current user is not involved", () => {
    // paidById: user-2 (Bob), no currentUser in participants
    const expense = makeExpense({ paidById: "user-2", participantIds: ["user-2"], amountCents: 2000 });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).not.toContain("you lent");
    expect(list?.textContent).not.toContain("you owe");
  });

  it("falls back to all members for personal stake calculation when participantIds is empty", () => {
    // Empty participantIds: should treat all members (user-1, user-2) as participants
    // current user (user-1) is payer, so they lent Bob's share
    const expense = makeExpense({ paidById: "user-1", participantIds: [], amountCents: 2000 });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    const list = document.querySelector("ul");
    // Alice lent Bob's half → "you lent $10.00"
    expect(list?.textContent).toContain("you lent");
    expect(list?.textContent).toContain("$10.00");
  });

  it("shows departed payer name using allUserNames fallback", () => {
    // paidById: user-99 (Charlie, departed — not in members list)
    const expense = makeExpense({ paidById: "user-99", participantIds: ["user-1"], amountCents: 3000 });
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "user-99": "Charlie" }}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Charlie paid");
    expect(list?.textContent).toContain("you owe");
  });

  it("shows edit and delete buttons for the expense creator", () => {
    // canEdit/canDelete = true when createdById matches currentUserId (set in page.tsx)
    const expense = makeExpense({ canEdit: true, canDelete: true });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(screen.queryByRole("button", { name: /edit expense/i }), "creator should see edit button").not.toBeNull();
    expect(screen.queryByRole("button", { name: /delete expense/i }), "creator should see delete button").not.toBeNull();
  });

  it("hides edit and delete buttons for a non-creator", () => {
    // canEdit/canDelete = false when createdById is set and doesn't match currentUserId
    const expense = makeExpense({ canEdit: false, canDelete: false });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    expect(screen.queryByRole("button", { name: /edit expense/i }), "non-creator should not see edit button").toBeNull();
    expect(screen.queryByRole("button", { name: /delete expense/i }), "non-creator should not see delete button").toBeNull();
  });

  it("does not show a comma-separated participant line for payment rows", () => {
    const payment = {
      id: "payment-1",
      description: "Payment",
      amountCents: 5000,
      date: "2024-03-01",
      paidById: "user-1",
      paidByDisplayName: "Alice",
      participantIds: ["user-2"],
      canEdit: false,
      canDelete: true,
      isPayment: true as const,
      createdById: "user-1",
    };
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[payment]} />);
    // Payment shows direction text ("you paid Bob"), not a comma-separated list
    expect(screen.queryByText("Alice, Bob")).toBeNull();
  });
});
