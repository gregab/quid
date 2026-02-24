// @vitest-environment happy-dom
// Tests for recurring expense UI: badge in ExpensesList, metadata in ExpenseDetailModal,
// recurring toggle in AddExpenseForm, and cron API route.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, within } from "@testing-library/react";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import { ExpensesList } from "./ExpensesList";
import type { ExpenseRow, Member } from "./ExpensesList";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
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
    amountCents:
      Math.floor(amountCents / participantIds.length) +
      (i < amountCents % participantIds.length ? 1 : 0),
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
    recurringExpense: null,
    ...overrides,
  };
}

const MODAL_BASE_PROPS = {
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

const LIST_BASE_PROPS = {
  groupId: "group-1",
  groupCreatedById: "creator-1",
  currentUserId: "user-1",
  currentUserDisplayName: "Alice",
  members: MEMBERS,
  allUserNames: { "user-1": "Alice", "user-2": "Bob" },
  userOwesDebts: [],
  onOptimisticActivity: vi.fn(),
};

// ─── ExpenseDetailModal — recurring metadata ─────────────────────────────────

describe("ExpenseDetailModal — recurring expense", () => {
  it("does not show recurring metadata for non-recurring expenses", () => {
    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({ recurringExpense: null })}
      />
    );
    expect(screen.queryByText(/recurring/i)).toBeNull();
    expect(screen.queryByText(/stop recurring/i)).toBeNull();
  });

  it("shows 'Recurring · monthly' and 'Stop recurring' for a monthly recurring expense", () => {
    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({
          recurringExpense: { id: "rec-1", frequency: "monthly" },
        })}
      />
    );
    expect(screen.getByText(/recurring · monthly/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /stop recurring/i })).toBeDefined();
  });

  it("shows 'Recurring · weekly' for a weekly recurring expense", () => {
    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({
          recurringExpense: { id: "rec-2", frequency: "weekly" },
        })}
      />
    );
    expect(screen.getByText(/recurring · weekly/i)).toBeDefined();
  });

  it("shows 'Recurring · yearly' for a yearly recurring expense", () => {
    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({
          recurringExpense: { id: "rec-3", frequency: "yearly" },
        })}
      />
    );
    expect(screen.getByText(/recurring · yearly/i)).toBeDefined();
  });

  it("calls DELETE /api/groups/[id]/recurring/[recurringId] and router.refresh() when Stop recurring is clicked", async () => {
    const { useRouter } = await import("next/navigation");
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      refresh: mockRefresh,
      push: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);

    const mockOnClose = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: null }), { status: 200 })
    );

    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        onClose={mockOnClose}
        expense={makeExpense({
          recurringExpense: { id: "rec-1", frequency: "monthly" },
        })}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recurring/i }));
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/groups/group-1/recurring/rec-1",
      { method: "DELETE" }
    );
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

// ─── ExpensesList — recurring badge ──────────────────────────────────────────

describe("ExpensesList — recurring badge", () => {
  it("does not render a repeat icon for non-recurring expenses", () => {
    const { container } = render(
      <ExpensesList
        {...LIST_BASE_PROPS}
        initialExpenses={[makeExpense({ recurringExpense: null })]}
      />
    );
    // The SVG for the recurring icon has a specific path; non-recurring expenses won't have it
    const repeatIcons = container.querySelectorAll('[aria-label="Recurring"]');
    expect(repeatIcons.length).toBe(0);
  });

  it("renders a repeat icon for recurring expenses", () => {
    const { container } = render(
      <ExpensesList
        {...LIST_BASE_PROPS}
        initialExpenses={[
          makeExpense({ recurringExpense: { id: "rec-1", frequency: "monthly" } }),
        ]}
      />
    );
    const repeatIcons = container.querySelectorAll('[aria-label="Recurring"]');
    expect(repeatIcons.length).toBe(1);
  });

  it("renders repeat icons only for recurring expenses in a mixed list", () => {
    const { container } = render(
      <ExpensesList
        {...LIST_BASE_PROPS}
        initialExpenses={[
          makeExpense({ id: "e-1", recurringExpense: { id: "rec-1", frequency: "weekly" } }),
          makeExpense({ id: "e-2", recurringExpense: null }),
          makeExpense({ id: "e-3", recurringExpense: { id: "rec-3", frequency: "yearly" } }),
        ]}
      />
    );
    const repeatIcons = container.querySelectorAll('[aria-label="Recurring"]');
    expect(repeatIcons.length).toBe(2);
  });
});

// ─── AddExpenseForm — repeat toggle ──────────────────────────────────────────

describe("AddExpenseForm — repeat toggle", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: null }), { status: 201 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openForm() {
    const { AddExpenseForm } = await import("./AddExpenseForm");
    const { container } = render(
      <AddExpenseForm
        groupId="group-1"
        currentUserId="user-1"
        currentUserDisplayName="Alice"
        members={MEMBERS}
        onOptimisticAdd={vi.fn()}
        onSettled={vi.fn()}
        onOptimisticActivity={vi.fn()}
      />
    );
    // Click "Add expense" trigger button
    fireEvent.click(screen.getByRole("button", { name: /add expense/i }));
    return container;
  }

  it("shows a Repeat checkbox in the form", async () => {
    await openForm();
    expect(screen.getByRole("checkbox", { name: /repeat/i })).toBeDefined();
  });

  it("does not show frequency dropdown when Repeat is unchecked", async () => {
    await openForm();
    // Frequency options appear only when Repeat is checked
    expect(screen.queryByDisplayValue("Monthly")).toBeNull();
    expect(screen.queryByDisplayValue("Weekly")).toBeNull();
  });

  it("shows frequency dropdown when Repeat is checked", async () => {
    await openForm();
    const repeatCheckbox = screen.getByRole("checkbox", { name: /repeat/i });
    fireEvent.click(repeatCheckbox);
    // The select for frequency should now be visible with "Monthly" as default
    const select = screen.getByDisplayValue("Monthly");
    expect(select).toBeDefined();
  });

  it("includes recurring field in POST body when Repeat is enabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: null }), { status: 201 })
    );

    await openForm();

    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Netflix" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "15.00" },
    });

    // Enable repeat with weekly frequency
    const repeatCheckbox = screen.getByRole("checkbox", { name: /repeat/i });
    fireEvent.click(repeatCheckbox);
    const frequencySelect = screen.getByDisplayValue("Monthly");
    fireEvent.change(frequencySelect, { target: { value: "weekly" } });

    // Submit using the form element directly
    const form = document.querySelector("form");
    await act(async () => {
      if (form) fireEvent.submit(form);
    });

    const lastCall = fetchSpy.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const body = JSON.parse(lastCall![1]!.body as string) as Record<string, unknown>;
    expect(body.recurring).toEqual({ frequency: "weekly" });

    fetchSpy.mockRestore();
  });

  it("does not include recurring field when Repeat is unchecked", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: null }), { status: 201 })
    );

    await openForm();

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "50.00" },
    });

    const form = document.querySelector("form");
    await act(async () => {
      if (form) fireEvent.submit(form);
    });

    const lastCall = fetchSpy.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const body = JSON.parse(lastCall![1]!.body as string) as Record<string, unknown>;
    expect(body.recurring).toBeUndefined();

    fetchSpy.mockRestore();
  });
});
