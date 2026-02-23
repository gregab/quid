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
  userOwesDebts: [],
  onOptimisticActivity: vi.fn(),
};

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  const participantIds = overrides.participantIds ?? ["user-1"];
  const amountCents = overrides.amountCents ?? 2500;
  const defaultSplits = participantIds.map((id, i) => ({
    userId: id,
    amountCents: Math.floor(amountCents / participantIds.length) + (i < amountCents % participantIds.length ? 1 : 0),
  }));
  return {
    id: "expense-1",
    description: "Dinner",
    amountCents,
    date: "2024-01-15",
    paidById: "user-1",
    paidByDisplayName: "Alice",
    participantIds,
    splits: defaultSplits,
    splitType: "equal",
    canEdit: true,
    canDelete: true,
    ...overrides,
  };
}

/** Clicks the first expense row button to open its detail modal. */
function openDetailModal(container: HTMLElement) {
  const rowBtn = container.querySelector("li button") as HTMLElement;
  fireEvent.click(rowBtn);
}

// ----------------------------
// Detail modal: edit/delete button visibility based on canEdit/canDelete
// ----------------------------

describe("ExpensesList — detail modal shows correct actions for creator vs non-creator", () => {
  it("shows Edit and Delete buttons in the modal for the expense creator (canEdit=true, canDelete=true)", () => {
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ canEdit: true, canDelete: true })]} />
    );
    openDetailModal(container);
    expect(screen.queryByRole("button", { name: /edit expense/i }), "creator should see Edit button").not.toBeNull();
    expect(screen.queryByRole("button", { name: /delete expense/i }), "creator should see Delete button").not.toBeNull();
  });

  it("hides Edit and Delete buttons in the modal for a non-creator (canEdit=false, canDelete=false)", () => {
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ canEdit: false, canDelete: false })]} />
    );
    openDetailModal(container);
    expect(screen.queryByRole("button", { name: /edit expense/i }), "non-creator should not see Edit button").toBeNull();
    expect(screen.queryByRole("button", { name: /delete expense/i }), "non-creator should not see Delete button").toBeNull();
  });

  it("shows 'Added by' the creator's name when the current user is not the creator", () => {
    const expense = makeExpense({ canEdit: false, canDelete: false, createdById: "user-2" });
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />
    );
    openDetailModal(container);
    const addedByEl = screen.getByText(/added by/i);
    expect(addedByEl.textContent).toContain("Bob");
  });

  it("shows 'Added by you' when the current user is the creator", () => {
    const expense = makeExpense({ canEdit: true, canDelete: true, createdById: "user-1" });
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />
    );
    openDetailModal(container);
    const addedByEl = screen.getByText(/added by/i);
    expect(addedByEl.textContent).toContain("you");
  });

  it("shows 'Last edited' when updatedAt is present", () => {
    const expense = makeExpense({ createdById: "user-1", updatedAt: "2024-02-01T10:30:00.000Z" });
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />
    );
    openDetailModal(container);
    expect(screen.getByText(/last edited/i)).toBeTruthy();
  });

  it("does not show 'Last edited' when updatedAt is absent", () => {
    const expense = makeExpense({ createdById: "user-1", updatedAt: undefined });
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />
    );
    openDetailModal(container);
    expect(screen.queryByText(/last edited/i)).toBeNull();
  });
});

// ----------------------------
// Detail modal: pending expense behavior
// ----------------------------

describe("ExpensesList — detail modal disables Edit/Delete while expense is pending", () => {
  it("Edit and Delete buttons are present in the modal for a pending expense (creator)", () => {
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ isPending: true, canEdit: true, canDelete: true })]} />
    );
    openDetailModal(container);
    expect(screen.queryByRole("button", { name: /edit expense/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /delete expense/i })).not.toBeNull();
  });

  it("Edit and Delete buttons are disabled in the modal while the expense is pending", () => {
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ isPending: true, canEdit: true, canDelete: true })]} />
    );
    openDetailModal(container);
    const editBtn = screen.queryByRole("button", { name: /edit expense/i }) as HTMLButtonElement | null;
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i }) as HTMLButtonElement | null;
    expect(editBtn!.disabled, "Edit should be disabled while pending").toBe(true);
    expect(deleteBtn!.disabled, "Delete should be disabled while pending").toBe(true);
  });

  it("Edit and Delete buttons are enabled in the modal once the expense is no longer pending", () => {
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeExpense({ isPending: false, canEdit: true, canDelete: true })]} />
    );
    openDetailModal(container);
    const editBtn = screen.queryByRole("button", { name: /edit expense/i }) as HTMLButtonElement | null;
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i }) as HTMLButtonElement | null;
    expect(editBtn!.disabled).toBe(false);
    expect(deleteBtn!.disabled).toBe(false);
  });
});

// ----------------------------
// Bug: pending item never replaced after router.refresh()
// ----------------------------

describe("ExpensesList — optimistic add: pending item resolved after prop update", () => {
  it("replaces pending item with real item when initialExpenses prop updates", () => {
    // After router.refresh(), the pending ghost should be replaced by the real item.
    // We verify by opening the detail modal: the Edit button should be enabled on the real item.
    const pending = makeExpense({ id: "pending-1", isPending: true, canEdit: true, canDelete: true });
    const real = makeExpense({ id: "real-1", isPending: false, canEdit: true, canDelete: true });

    const { rerender, container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[pending]} />
    );

    // Simulate router.refresh() delivering real server data
    rerender(<ExpensesList {...BASE_PROPS} initialExpenses={[real]} />);

    openDetailModal(container);
    const editBtn = screen.queryByRole("button", { name: /edit expense/i }) as HTMLButtonElement | null;
    expect(editBtn, "Edit button must exist after real item arrives").not.toBeNull();
    expect(editBtn!.disabled, "Edit button should be enabled once item is no longer pending").toBe(false);
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

    // Open detail modal for "Newer" (first row)
    const rowBtns = container.querySelectorAll("li button");
    fireEvent.click(rowBtns[0]!);

    // Click the Edit button in the detail modal
    fireEvent.click(screen.getByRole("button", { name: /edit expense/i }));

    // Change its date to be earlier than "Older"
    const dateInput = screen.getByLabelText("Date");
    fireEvent.change(dateInput, { target: { value: "2024-01-05" } });

    // Submit via the form
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

    // Open detail modal for "Newer" and edit to an even more recent date
    const rowBtns = container.querySelectorAll("li button");
    fireEvent.click(rowBtns[0]!);
    fireEvent.click(screen.getByRole("button", { name: /edit expense/i }));

    const dateInput = screen.getByLabelText("Date");
    fireEvent.change(dateInput, { target: { value: "2024-01-25" } });

    const form = screen.getByRole("button", { name: /save changes/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
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
      splits: [{ userId: "user-2", amountCents: 5000 }],
      splitType: "equal",
      canEdit: false,
      canDelete: true,
      isPayment: true,
      createdById: "user-1",
      ...overrides,
    };
  }

  it("renders the Payment badge for payment rows", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[makePayment()]} />);
    expect(screen.getByText(/^Payment ·/)).toBeDefined();
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

  it("does NOT show Edit button in detail modal for payment rows", () => {
    const { container } = render(<ExpensesList {...BASE_PROPS} initialExpenses={[makePayment()]} />);
    openDetailModal(container);
    const editBtn = screen.queryByRole("button", { name: /edit expense/i });
    expect(editBtn, "payments should not have an Edit button").toBeNull();
  });

  it("shows Delete button in detail modal for payments the current user created", () => {
    const { container } = render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[makePayment({ canDelete: true })]}
      />
    );
    openDetailModal(container);
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i });
    expect(deleteBtn, "creator should see Delete button").not.toBeNull();
  });

  it("does not show Delete button in detail modal for payments the current user did not create", () => {
    const { container } = render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[makePayment({ canDelete: false, createdById: "user-2" })]}
      />
    );
    openDetailModal(container);
    const deleteBtn = screen.queryByRole("button", { name: /delete expense/i });
    expect(deleteBtn, "non-creator should not see Delete button").toBeNull();
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
// Settled-up payment cards
// ----------------------------

describe("ExpensesList — settled-up payment card rendering", () => {
  function makeSettledPayment(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
    return {
      id: "settled-1",
      description: "Payment",
      amountCents: 5000,
      date: "2024-03-01",
      paidById: "user-1",
      paidByDisplayName: "Alice",
      participantIds: ["user-2"],
      splits: [{ userId: "user-2", amountCents: 5000 }],
      splitType: "equal",
      canEdit: false,
      canDelete: true,
      isPayment: true,
      settledUp: true,
      createdById: "user-1",
      ...overrides,
    };
  }

  it("shows 'settled up with' verbiage instead of 'paid' for settled-up payments", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[makeSettledPayment()]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("settled up with");
    expect(list?.textContent).not.toContain("you paid");
    expect(list?.textContent).not.toContain("paid you");
  });

  it("uses display names (not 'you') in the settled-up title", () => {
    // paidById: user-1 (Alice = currentUser), recipient: user-2 (Bob)
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[makeSettledPayment()]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Alice settled up with Bob");
  });

  it("uses display names for settled-up payment between two other users", () => {
    const payment = makeSettledPayment({ paidById: "user-2", participantIds: ["user-3"], createdById: "user-2" });
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
    expect(list?.textContent).toContain("Bob settled up with Charlie");
  });

  it("appends ✨ to the settled-up title", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[makeSettledPayment()]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("✨");
  });

  it("renders amount in emerald for settled-up payments", () => {
    const { container } = render(
      <ExpensesList {...BASE_PROPS} initialExpenses={[makeSettledPayment()]} />
    );
    const amountEl = container.querySelector(".text-emerald-700.font-bold");
    expect(amountEl, "amount should have emerald color class").not.toBeNull();
    expect(amountEl!.textContent).toContain("$50.00");
  });

  it("does NOT show settled-up style for regular (non-settled) payments", () => {
    const regularPayment = makeSettledPayment({ settledUp: false });
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[regularPayment]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).not.toContain("settled up with");
    expect(list?.textContent).toContain("you paid");
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
    // Payer line: "[payer] paid $X"
    expect(list?.textContent).toContain("Bob paid");
    expect(list?.textContent).toContain("$20.00");
    // Personal stake shows "you owe" when someone else paid
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

  it("shows correct personal stake using stored splits (not recomputed from participantIds)", () => {
    // Alice paid $2000 split with Bob ($1000 each via splits)
    // Alice is payer, so she lent Bob's share
    const expense = makeExpense({
      paidById: "user-1",
      participantIds: ["user-1", "user-2"],
      amountCents: 2000,
      splits: [
        { userId: "user-1", amountCents: 1000 },
        { userId: "user-2", amountCents: 1000 },
      ],
    });
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
    // Personal stake shows "you owe" when someone else paid
    expect(list?.textContent).toContain("you owe");
  });

  it("does not show a comma-separated participant line for payment rows", () => {
    const payment: ExpenseRow = {
      id: "payment-1",
      description: "Payment",
      amountCents: 5000,
      date: "2024-03-01",
      paidById: "user-1",
      paidByDisplayName: "Alice",
      participantIds: ["user-2"],
      splits: [{ userId: "user-2", amountCents: 5000 }],
      splitType: "equal",
      canEdit: false,
      canDelete: true,
      isPayment: true,
      createdById: "user-1",
    };
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[payment]} />);
    // Payment shows direction text ("you paid Bob"), not a comma-separated list
    expect(screen.queryByText("Alice, Bob")).toBeNull();
  });
});

// ----------------------------
// Custom splits: personal stake display
// ----------------------------

describe("ExpensesList — custom splits personal stake display", () => {
  it("shows the correct 'you owe' amount for a custom split (not equal)", () => {
    // $100 expense: Alice paid, Bob owes $60, Alice owes $40 (uneven)
    const expense = makeExpense({
      paidById: "user-1",
      participantIds: ["user-1", "user-2"],
      amountCents: 10000,
      splitType: "custom",
      splits: [
        { userId: "user-1", amountCents: 4000 },
        { userId: "user-2", amountCents: 6000 },
      ],
    });
    // Current user (user-1) is payer → "you lent" = total - myShare = $100 - $40 = $60
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you lent");
    expect(list?.textContent).toContain("$60.00");
  });

  it("shows 'you owe' the exact custom amount when someone else paid", () => {
    // $100 expense: Bob paid, Alice owes $40 (custom), Bob owes $60
    const expense = makeExpense({
      paidById: "user-2",
      participantIds: ["user-1", "user-2"],
      amountCents: 10000,
      splitType: "custom",
      splits: [
        { userId: "user-1", amountCents: 4000 },
        { userId: "user-2", amountCents: 6000 },
      ],
    });
    // Current user (user-1) is participant, Bob paid → "you owe $40.00"
    render(<ExpensesList {...BASE_PROPS} initialExpenses={[expense]} />);
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you owe");
    expect(list?.textContent).toContain("$40.00");
  });
});

// ----------------------------
// Departed / deleted member name resolution
// ----------------------------

describe("ExpensesList — departed member name resolution", () => {
  it("shows departed payer name from allUserNames when payer is not in members", () => {
    const expense = makeExpense({
      paidById: "user-99",
      paidByDisplayName: "Charlie",
      participantIds: ["user-1"],
      amountCents: 3000,
    });
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "user-99": "Charlie" }}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Charlie paid");
  });

  it("shows 'Unknown' when payer is not in members or allUserNames", () => {
    const expense = makeExpense({
      paidById: "ghost-user",
      paidByDisplayName: "???",
      participantIds: ["user-1"],
      amountCents: 3000,
    });
    render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Unknown paid");
  });

  it("shows correct personal stake when departed member paid the expense", () => {
    // Charlie (departed) paid $60 split with alice (user-1). Alice owes $30.
    const expense = makeExpense({
      paidById: "user-99",
      paidByDisplayName: "Charlie",
      participantIds: ["user-1", "user-99"],
      amountCents: 6000,
    });
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "user-99": "Charlie" }}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you owe");
    expect(list?.textContent).toContain("$30.00");
  });

  it("shows 'you lent' when current user paid and departed member is a participant", () => {
    // Alice (user-1) paid $80 split with charlie (departed, user-99)
    const expense = makeExpense({
      paidById: "user-1",
      paidByDisplayName: "Alice",
      participantIds: ["user-1", "user-99"],
      amountCents: 8000,
    });
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "user-99": "Charlie" }}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you lent");
    expect(list?.textContent).toContain("$40.00");
  });

  it("shows departed payer name in payment direction for payments between departed member and current user", () => {
    // Payment: Charlie (departed) paid Alice $50
    const payment: ExpenseRow = {
      id: "pay-1",
      description: "Payment",
      amountCents: 5000,
      date: "2024-03-01",
      paidById: "user-99",
      paidByDisplayName: "Charlie",
      participantIds: ["user-1"],
      splits: [{ userId: "user-1", amountCents: 5000 }],
      splitType: "equal",
      canEdit: false,
      canDelete: false,
      isPayment: true,
      createdById: "user-99",
    };
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "user-99": "Charlie" }}
        initialExpenses={[payment]}
      />
    );
    const list = document.querySelector("ul");
    // Charlie paid you
    expect(list?.textContent).toContain("Charlie");
    expect(list?.textContent).toContain("paid you");
  });

  it("shows both departed members' names in payment direction between two departed users", () => {
    // Payment: Dave (departed) paid Charlie (departed) $30
    const payment: ExpenseRow = {
      id: "pay-2",
      description: "Payment",
      amountCents: 3000,
      date: "2024-03-01",
      paidById: "user-88",
      paidByDisplayName: "Dave",
      participantIds: ["user-99"],
      splits: [{ userId: "user-99", amountCents: 3000 }],
      splitType: "equal",
      canEdit: false,
      canDelete: false,
      isPayment: true,
      createdById: "user-88",
    };
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "user-99": "Charlie", "user-88": "Dave" }}
        initialExpenses={[payment]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Dave");
    expect(list?.textContent).toContain("Charlie");
    expect(list?.textContent).toContain("→");
  });
});

// ----------------------------
// Deleted account scenarios (User row completely gone)
// ----------------------------

describe("ExpensesList — deleted account display", () => {
  it("shows 'Unknown' for a deleted user whose ID is not in allUserNames", () => {
    const expense = makeExpense({
      paidById: "deleted-user-id",
      paidByDisplayName: "Unknown",
      participantIds: ["user-1"],
      amountCents: 5000,
    });
    render(
      <ExpensesList
        {...BASE_PROPS}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Unknown paid");
  });

  it("shows the original name when allUserNames captured it from expense joins", () => {
    const expense = makeExpense({
      paidById: "deleted-user-id",
      paidByDisplayName: "Dave",
      participantIds: ["user-1"],
      amountCents: 5000,
    });
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "deleted-user-id": "Dave" }}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("Dave paid");
  });

  it("still calculates correct personal stake when the payer account was deleted", () => {
    // Deleted Dave paid $100 split with alice
    const expense = makeExpense({
      paidById: "deleted-user-id",
      paidByDisplayName: "Dave",
      participantIds: ["user-1", "deleted-user-id"],
      amountCents: 10000,
    });
    render(
      <ExpensesList
        {...BASE_PROPS}
        allUserNames={{ "user-1": "Alice", "user-2": "Bob", "deleted-user-id": "Dave" }}
        initialExpenses={[expense]}
      />
    );
    const list = document.querySelector("ul");
    expect(list?.textContent).toContain("you owe");
    expect(list?.textContent).toContain("$50.00");
  });
});

describe("ExpensesList — display truncation", () => {
  function makeExpenses(count: number): ExpenseRow[] {
    return Array.from({ length: count }, (_, i) =>
      makeExpense({ id: `expense-${i}`, description: `Expense ${i}` })
    );
  }

  it("shows all expenses when there are 30 or fewer", () => {
    const expenses = makeExpenses(30);
    render(<ExpensesList {...BASE_PROPS} initialExpenses={expenses} />);
    expect(screen.queryByText(/Show \d+ more/)).toBeNull();
    const items = document.querySelectorAll("li");
    expect(items).toHaveLength(30);
  });

  it("shows only 30 expenses when there are more than 30", () => {
    const expenses = makeExpenses(35);
    render(<ExpensesList {...BASE_PROPS} initialExpenses={expenses} />);
    const items = document.querySelectorAll("li");
    expect(items).toHaveLength(30);
  });

  it("shows 'Show N more' button when more than 30 expenses exist", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={makeExpenses(35)} />);
    expect(screen.getByText("Show 5 more")).toBeDefined();
  });

  it("reveals more expenses when 'Show N more' is clicked", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={makeExpenses(35)} />);
    fireEvent.click(screen.getByText("Show 5 more"));
    const items = document.querySelectorAll("li");
    expect(items).toHaveLength(35);
  });

  it("hides the Show more button after all expenses are revealed", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={makeExpenses(35)} />);
    fireEvent.click(screen.getByText("Show 5 more"));
    expect(screen.queryByText(/Show \d+ more/)).toBeNull();
  });

  it("caps each 'Show more' click at 30 additional items", () => {
    render(<ExpensesList {...BASE_PROPS} initialExpenses={makeExpenses(65)} />);
    expect(screen.getByText("Show 30 more")).toBeDefined();
    fireEvent.click(screen.getByText("Show 30 more"));
    expect(document.querySelectorAll("li")).toHaveLength(60);
    expect(screen.getByText("Show 5 more")).toBeDefined();
  });
});
