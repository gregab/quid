// @vitest-environment happy-dom
// Tests for recurring expense UI: badge in ExpensesList, metadata in ExpenseDetailModal,
// recurring toggle in AddExpenseForm.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
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
  inviteToken: "test-invite-token",
  onOptimisticActivity: vi.fn(),
};

// ─── ExpenseDetailModal — recurring metadata display ─────────────────────────

describe("ExpenseDetailModal — recurring expense display", () => {
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
});

// ─── ExpenseDetailModal — recurring expenses are not editable ────────────────

describe("ExpenseDetailModal — recurring expenses cannot be edited", () => {
  it("does not show the Edit button for a recurring expense (canEdit=false)", () => {
    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({
          recurringExpense: { id: "rec-1", frequency: "monthly" },
          canEdit: false,
        })}
      />
    );
    expect(screen.queryByRole("button", { name: /edit expense/i })).toBeNull();
  });

  it("still shows the Edit button for a non-recurring expense (canEdit=true)", () => {
    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({ recurringExpense: null, canEdit: true })}
      />
    );
    expect(screen.getByRole("button", { name: /edit expense/i })).toBeDefined();
  });
});

// ─── ExpenseDetailModal — Stop recurring happy path ──────────────────────────

describe("ExpenseDetailModal — Stop recurring", () => {
  it("calls DELETE endpoint, closes modal, and refreshes on success", async () => {
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

  it("shows error message and does NOT close the modal when the server returns an error", async () => {
    const { useRouter } = await import("next/navigation");
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      refresh: mockRefresh,
      push: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);

    const mockOnClose = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ data: null, error: "Not a member of this group" }),
        { status: 500 }
      )
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

    // Error message should be shown
    expect(screen.getByText(/not a member of this group/i)).toBeDefined();
    // Modal should NOT have closed
    expect(mockOnClose).not.toHaveBeenCalled();
    // router.refresh should NOT have been called
    expect(mockRefresh).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("shows generic error when server returns non-JSON error response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );

    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({
          recurringExpense: { id: "rec-1", frequency: "monthly" },
        })}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recurring/i }));
    });

    expect(screen.getByText(/something went wrong/i)).toBeDefined();

    fetchSpy.mockRestore();
  });

  it("disables the Stop recurring button while loading", async () => {
    // Use a promise that never resolves to freeze the loading state
    let resolveRequest!: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(pendingPromise);

    render(
      <ExpenseDetailModal
        {...MODAL_BASE_PROPS}
        expense={makeExpense({
          recurringExpense: { id: "rec-1", frequency: "monthly" },
        })}
      />
    );

    const stopButton = screen.getByRole("button", { name: /stop recurring/i });
    fireEvent.click(stopButton);

    // Button should be disabled during loading
    expect(stopButton).toHaveProperty("disabled", true);
    expect(screen.getByText(/stopping…/i)).toBeDefined();

    // Clean up by resolving the promise
    resolveRequest(
      new Response(JSON.stringify({ data: null, error: null }), { status: 200 })
    );
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
    const repeatIcons = container.querySelectorAll('[aria-label="Recurring"]');
    expect(repeatIcons.length).toBe(0);
  });

  it("renders a repeat icon for a monthly recurring expense", () => {
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

  it("renders a repeat icon for a weekly recurring expense", () => {
    const { container } = render(
      <ExpensesList
        {...LIST_BASE_PROPS}
        initialExpenses={[
          makeExpense({ recurringExpense: { id: "rec-2", frequency: "weekly" } }),
        ]}
      />
    );
    const repeatIcons = container.querySelectorAll('[aria-label="Recurring"]');
    expect(repeatIcons.length).toBe(1);
  });

  it("renders a repeat icon for a yearly recurring expense", () => {
    const { container } = render(
      <ExpensesList
        {...LIST_BASE_PROPS}
        initialExpenses={[
          makeExpense({ recurringExpense: { id: "rec-3", frequency: "yearly" } }),
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

  it("does not show a repeat icon for payment rows (isPayment=true)", () => {
    const { container } = render(
      <ExpensesList
        {...LIST_BASE_PROPS}
        initialExpenses={[
          makeExpense({
            isPayment: true,
            recurringExpense: { id: "rec-1", frequency: "monthly" },
          }),
        ]}
      />
    );
    // Payment rows use a different render path — description span is not shown
    const repeatIcons = container.querySelectorAll('[aria-label="Recurring"]');
    expect(repeatIcons.length).toBe(0);
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
    render(
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
    fireEvent.click(screen.getByRole("button", { name: /add expense/i }));
  }

  it("shows a Repeat checkbox in the form", async () => {
    await openForm();
    expect(screen.getByRole("checkbox", { name: /repeat/i })).toBeDefined();
  });

  it("Repeat checkbox is unchecked by default", async () => {
    await openForm();
    const checkbox = screen.getByRole("checkbox", { name: /repeat/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("does not show frequency dropdown when Repeat is unchecked", async () => {
    await openForm();
    expect(screen.queryByDisplayValue("Monthly")).toBeNull();
    expect(screen.queryByDisplayValue("Weekly")).toBeNull();
    expect(screen.queryByDisplayValue("Yearly")).toBeNull();
  });

  it("shows frequency dropdown with 'Monthly' default when Repeat is checked", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("checkbox", { name: /repeat/i }));
    const select = screen.getByDisplayValue("Monthly");
    expect(select).toBeDefined();
  });

  it("frequency dropdown has Weekly, Monthly, Yearly options", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("checkbox", { name: /repeat/i }));
    const select = screen.getByDisplayValue("Monthly") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["weekly", "monthly", "yearly"]);
  });

  it("hides frequency dropdown when Repeat is unchecked again", async () => {
    await openForm();
    const checkbox = screen.getByRole("checkbox", { name: /repeat/i });
    fireEvent.click(checkbox); // check
    expect(screen.getByDisplayValue("Monthly")).toBeDefined();
    fireEvent.click(checkbox); // uncheck
    expect(screen.queryByDisplayValue("Monthly")).toBeNull();
  });

  it("includes recurring.frequency in POST body when Repeat is enabled (weekly)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: null }), { status: 201 })
    );

    await openForm();

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Netflix" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "15.00" },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /repeat/i }));
    const frequencySelect = screen.getByDisplayValue("Monthly");
    fireEvent.change(frequencySelect, { target: { value: "weekly" } });

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

  it("includes recurring.frequency in POST body when Repeat is enabled (monthly default)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: null }), { status: 201 })
    );

    await openForm();

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Rent" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "1200.00" },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /repeat/i }));
    // Leave frequency at default "Monthly"

    const form = document.querySelector("form");
    await act(async () => {
      if (form) fireEvent.submit(form);
    });

    const lastCall = fetchSpy.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const body = JSON.parse(lastCall![1]!.body as string) as Record<string, unknown>;
    expect(body.recurring).toEqual({ frequency: "monthly" });

    fetchSpy.mockRestore();
  });

  it("does NOT include recurring field in POST body when Repeat is unchecked", async () => {
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

  it("does NOT include recurring field if Repeat is checked then unchecked before submit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: null }), { status: 201 })
    );

    await openForm();

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Movies" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "20.00" },
    });

    const checkbox = screen.getByRole("checkbox", { name: /repeat/i });
    fireEvent.click(checkbox); // check
    fireEvent.click(checkbox); // uncheck

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
