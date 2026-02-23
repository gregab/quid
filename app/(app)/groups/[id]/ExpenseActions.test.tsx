// @vitest-environment happy-dom
// Tests for ExpenseDetailModal — the detail/edit modal that replaced ExpenseActions.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import type { ExpenseRow, Member } from "./ExpensesList";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const MEMBERS: Member[] = [
  { userId: "user-1", displayName: "Alice" },
  { userId: "user-2", displayName: "Bob" },
];

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  const participantIds = overrides.participantIds ?? ["user-1", "user-2"];
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

const BASE_PROPS = {
  groupId: "group-1",
  members: MEMBERS,
  allUserNames: { "user-1": "Alice", "user-2": "Bob" },
  currentUserId: "user-1",
  currentUserDisplayName: "Alice",
  onClose: vi.fn(),
  onOptimisticDelete: vi.fn(),
  onDeleteFailed: vi.fn(),
  onDeleteSettled: vi.fn(),
  onOptimisticUpdate: vi.fn(),
  onUpdateSettled: vi.fn(),
  onOptimisticActivity: vi.fn(),
};

/** Renders the modal in view mode, then clicks Edit to enter edit mode. */
function openEditModal(expense: ExpenseRow = makeExpense()) {
  render(<ExpenseDetailModal {...BASE_PROPS} expense={expense} />);
  fireEvent.click(screen.getByRole("button", { name: /edit expense/i }));
}

describe("ExpenseDetailModal — view mode", () => {
  it("shows the expense description as the title", () => {
    render(<ExpenseDetailModal {...BASE_PROPS} expense={makeExpense()} />);
    expect(screen.getByRole("heading", { name: "Dinner" })).toBeDefined();
  });

  it("shows amount, date, paid-by, and per-person split breakdown", () => {
    render(<ExpenseDetailModal {...BASE_PROPS} expense={makeExpense()} />);
    // Amount appears once in the "Paid by" card (no longer duplicated in a standalone header)
    expect(screen.getAllByText("$25.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/January 15, 2024/)).toBeDefined();
    // paidById = user-1 = currentUserId, so shows "(you)" in both Paid by card and split row
    expect(screen.getAllByText(/alice.*\(you\)/i).length).toBeGreaterThanOrEqual(1);
    // Per-person shares: $25.00 / 2 = $12.50 each
    expect(screen.getAllByText("$12.50").length).toBe(2);
  });

  it("shows 'Added by [name]' for a non-creator expense", () => {
    const expense = makeExpense({ canEdit: false, canDelete: false, createdById: "user-2" });
    render(<ExpenseDetailModal {...BASE_PROPS} expense={expense} />);
    const addedBy = screen.getByText(/added by/i);
    expect(addedBy.textContent).toContain("Bob");
  });

  it("shows 'Added by you' when the current user is the creator", () => {
    const expense = makeExpense({ canEdit: true, canDelete: true, createdById: "user-1" });
    render(<ExpenseDetailModal {...BASE_PROPS} expense={expense} />);
    const addedBy = screen.getByText(/added by/i);
    expect(addedBy.textContent).toContain("you");
  });
});

describe("ExpenseDetailModal — Save changes button disabled until something changes", () => {
  it("is disabled when the form is opened with no changes", () => {
    openEditModal();
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("becomes enabled after changing the description", () => {
    openEditModal();
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Lunch" } });
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("becomes enabled after changing the amount", () => {
    openEditModal();
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "30.00" } });
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("becomes enabled after changing the date", () => {
    openEditModal();
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: "2024-02-01" } });
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("becomes enabled after changing the payer", () => {
    openEditModal();
    fireEvent.change(screen.getByLabelText(/paid by/i), { target: { value: "user-2" } });
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("becomes enabled after toggling a participant", () => {
    openEditModal();
    // Uncheck one of the checked participants
    const checkboxes = screen.getAllByRole("checkbox");
    const checkedBox = checkboxes.find((cb) => (cb as HTMLInputElement).checked) ?? checkboxes[1];
    fireEvent.click(checkedBox!);
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("reverts to disabled when a change is undone", () => {
    openEditModal();
    const descInput = screen.getByLabelText(/description/i);
    fireEvent.change(descInput, { target: { value: "Lunch" } });
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(descInput, { target: { value: "Dinner" } });
    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
