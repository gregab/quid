// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ExpenseActions } from "./ExpenseActions";
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
  return {
    id: "expense-1",
    description: "Dinner",
    amountCents: 2500,
    date: "2024-01-15",
    paidById: "user-1",
    paidByDisplayName: "Alice",
    participantIds: ["user-1", "user-2"],
    canEdit: true,
    canDelete: true,
    ...overrides,
  };
}

const BASE_PROPS = {
  groupId: "group-1",
  members: MEMBERS,
  currentUserDisplayName: "Alice",
  onOptimisticDelete: vi.fn(),
  onDeleteFailed: vi.fn(),
  onDeleteSettled: vi.fn(),
  onOptimisticUpdate: vi.fn(),
  onUpdateSettled: vi.fn(),
  onOptimisticActivity: vi.fn(),
};

function openEditModal(expense: ExpenseRow = makeExpense()) {
  render(<ExpenseActions {...BASE_PROPS} expense={expense} />);
  fireEvent.click(screen.getByRole("button", { name: /edit expense/i }));
}

describe("Save changes button — disabled until something changes", () => {
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
    // Uncheck Bob
    const checkboxes = screen.getAllByRole("checkbox");
    const bobCheckbox = checkboxes.find((cb) => (cb as HTMLInputElement).checked) ?? checkboxes[1];
    fireEvent.click(bobCheckbox);
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
