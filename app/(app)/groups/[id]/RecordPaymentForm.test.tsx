// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { RecordPaymentForm } from "./RecordPaymentForm";
import type { ExpenseRow } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const MEMBERS = [
  { userId: "user-a", displayName: "Alice" },
  { userId: "user-b", displayName: "Bob" },
  { userId: "user-c", displayName: "Carol" },
];

const BASE_PROPS = {
  groupId: "group-1",
  currentUserId: "user-a",
  currentUserDisplayName: "Alice",
  members: MEMBERS,
  onOptimisticAdd: vi.fn(),
  onSettled: vi.fn(),
  onOptimisticActivity: vi.fn(),
};

const BOB_DEBT = { toId: "user-b", toName: "Bob", amountCents: 4250 };
const CAROL_DEBT = { toId: "user-c", toName: "Carol", amountCents: 1800 };

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /settle up/i }));
}

function clickDebtRow(name: string) {
  fireEvent.click(screen.getByText(name).closest("button")!);
}

function getAmountInput(): HTMLInputElement {
  return screen.getByPlaceholderText("0.00") as HTMLInputElement;
}

function getForm(): HTMLFormElement {
  return document.querySelector("form")!;
}

// ─── Button ──────────────────────────────────────────────────────────────────

describe("RecordPaymentForm — Settle Up button", () => {
  it("renders a 'Settle up' button (not 'Record payment')", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    expect(screen.getByRole("button", { name: /settle up/i })).toBeTruthy();
    expect(screen.queryByText(/^record payment$/i)).toBeNull();
  });
});

// ─── Pick step: no debts ──────────────────────────────────────────────────────

describe("RecordPaymentForm — Pick step (no debts)", () => {
  it("shows settled-up message and 'Record other payment' when user owes nobody", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    expect(screen.getByText(/you're all settled up/i)).toBeTruthy();
    expect(screen.getByText(/record other payment/i)).toBeTruthy();
  });

  it("does not show any debt rows when userOwesDebts is empty", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    expect(screen.queryByText("Bob")).toBeNull();
    expect(screen.queryByText("Carol")).toBeNull();
  });
});

// ─── Pick step: with debts ────────────────────────────────────────────────────

describe("RecordPaymentForm — Pick step (with debts)", () => {
  it("shows each person owed with their amount", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT, CAROL_DEBT]} />);
    openModal();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("$42.50")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
    expect(screen.getByText("$18.00")).toBeTruthy();
  });

  it("shows 'Record other payment' at the bottom when user has debts", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    expect(screen.getByText(/record other payment/i)).toBeTruthy();
  });

  it("does not show the settled-up message when user has debts", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    expect(screen.queryByText(/you're all settled up/i)).toBeNull();
  });
});

// ─── Modal lifecycle ──────────────────────────────────────────────────────────

describe("RecordPaymentForm — Modal lifecycle", () => {
  it("modal is closed initially", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    // No backdrop means the modal is not open
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    // The modal heading (h2) is absent; only the button exists
    expect(screen.queryByRole("heading", { name: /settle up/i })).toBeNull();
  });

  it("clicking 'Settle up' opens the modal at the pick step", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    expect(document.querySelector(".modal-backdrop")).not.toBeNull();
    // Modal heading (h2) now present — distinct from the trigger button
    expect(screen.getByRole("heading", { name: /settle up/i })).toBeTruthy();
  });

  it("X button closes the modal", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(document.querySelector(".modal-backdrop")).toBeNull();
  });

  it("clicking the backdrop closes the modal", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    const backdrop = document.querySelector(".modal-backdrop")!;
    fireEvent.click(backdrop);
    expect(document.querySelector(".modal-backdrop")).toBeNull();
  });

  it("Cancel button on the form step closes the modal", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(document.querySelector(".modal-backdrop")).toBeNull();
  });

  it("closing from form step then reopening starts at the pick step", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    expect(screen.getByText("Pay Bob")).toBeTruthy();
    // Close via Cancel
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    // Reopen
    openModal();
    // Should be back at pick step (heading is the h2, not the trigger button)
    expect(screen.getByRole("heading", { name: /settle up/i })).toBeTruthy();
    expect(screen.queryByText("Pay Bob")).toBeNull();
  });
});

// ─── Form step: preset (via debt row) ────────────────────────────────────────

describe("RecordPaymentForm — Form step via debt selection", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navigates to form step with title 'Pay Bob' when Bob's row is clicked", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    expect(screen.getByText("Pay Bob")).toBeTruthy();
  });

  it("pre-populates the amount field with the exact debt amount", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    expect(getAmountInput().value).toBe("42.50");
  });

  it("shows locked (non-dropdown) From and To fields in preset mode", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    // No dropdowns for From/To in preset mode
    expect(screen.queryByLabelText(/from \(who sent money\)/i)).toBeNull();
    expect(screen.queryByLabelText(/to \(who received money\)/i)).toBeNull();
    // Locked display fields are visible
    expect(screen.getByText(/Alice/)).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("allows modifying the pre-populated amount", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    fireEvent.change(getAmountInput(), { target: { value: "20.00" } });
    expect(getAmountInput().value).toBe("20.00");
  });

  it("back button returns to pick step", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.queryByText("Pay Bob")).toBeNull();
  });

  it("back button clears the pre-populated amount", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT, CAROL_DEBT]} />);
    openModal();
    clickDebtRow("Bob"); // pre-fills "42.50"
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    clickDebtRow("Carol"); // should pre-fill "18.00"
    expect(getAmountInput().value).toBe("18.00");
  });

  it("each debt row navigates independently with correct name and amount", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT, CAROL_DEBT]} />);
    openModal();
    clickDebtRow("Carol");
    expect(screen.getByText("Pay Carol")).toBeTruthy();
    expect(getAmountInput().value).toBe("18.00");
  });
});

// ─── Form step: free-form ("Record other payment") ───────────────────────────

describe("RecordPaymentForm — Form step via 'Record other payment'", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 'Record a payment' title with dropdowns for From and To", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    expect(screen.getByText("Record a payment")).toBeTruthy();
    expect(screen.getByLabelText(/from \(who sent money\)/i)).toBeTruthy();
    expect(screen.getByLabelText(/to \(who received money\)/i)).toBeTruthy();
  });

  it("amount field is empty when entering via 'Record other payment'", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    expect(getAmountInput().value).toBe("");
  });

  it("'Record other payment' is also accessible when user has debts", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    expect(screen.getByText("Record a payment")).toBeTruthy();
  });
});

// ─── Submission: preset mode ──────────────────────────────────────────────────

describe("RecordPaymentForm — Submission (preset mode)", () => {
  let onOptimisticAdd: Mock<(expense: ExpenseRow) => void>;
  let onSettled: Mock<() => void>;
  let onOptimisticActivity: Mock<(log: ActivityLog) => void>;

  beforeEach(() => {
    onOptimisticAdd = vi.fn<(expense: ExpenseRow) => void>();
    onSettled = vi.fn<() => void>();
    onOptimisticActivity = vi.fn<(log: ActivityLog) => void>();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderAndSelectBob() {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={[BOB_DEBT]}
        onOptimisticAdd={onOptimisticAdd}
        onSettled={onSettled}
        onOptimisticActivity={onOptimisticActivity}
      />
    );
    openModal();
    clickDebtRow("Bob");
  }

  it("calls fetch with correct body on preset submission", async () => {
    renderAndSelectBob();
    await act(async () => { fireEvent.submit(getForm()); });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/groups/group-1/payments");
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.amountCents).toBe(4250);
    expect(body.paidById).toBe("user-a");
    expect(body.recipientId).toBe("user-b");
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.date).toBe(new Date().toISOString().split("T")[0]);
  });

  it("does not render a date input field", () => {
    renderAndSelectBob();
    expect(document.querySelector("input[type=date]")).toBeNull();
  });

  it("calls onOptimisticAdd with correct isPayment expense", async () => {
    renderAndSelectBob();
    await act(async () => { fireEvent.submit(getForm()); });
    expect(onOptimisticAdd).toHaveBeenCalledOnce();
    const expense = onOptimisticAdd.mock.calls[0][0];
    expect(expense.isPayment).toBe(true);
    expect(expense.paidById).toBe("user-a");
    expect(expense.amountCents).toBe(4250);
    expect(expense.splits).toEqual([{ userId: "user-b", amountCents: 4250 }]);
    expect(expense.isPending).toBe(true);
    expect(expense.canEdit).toBe(false);
  });

  it("calls onOptimisticActivity with correct payload", async () => {
    renderAndSelectBob();
    await act(async () => { fireEvent.submit(getForm()); });
    expect(onOptimisticActivity).toHaveBeenCalledOnce();
    const log = onOptimisticActivity.mock.calls[0][0];
    const payload = log.payload as Record<string, unknown>;
    expect(log.action).toBe("payment_recorded");
    expect(payload.amountCents).toBe(4250);
    expect(payload.fromDisplayName).toBe("Alice");
    expect(payload.toDisplayName).toBe("Bob");
    expect(log.isPending).toBe(true);
  });

  it("uses the user-modified amount, not the original debt amount", async () => {
    renderAndSelectBob();
    // Change from $42.50 to $20.00
    fireEvent.change(getAmountInput(), { target: { value: "20.00" } });
    await act(async () => { fireEvent.submit(getForm()); });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.amountCents).toBe(2000);
    expect(onOptimisticAdd.mock.calls[0][0].amountCents).toBe(2000);
    expect((onOptimisticActivity.mock.calls[0][0].payload as Record<string, unknown>).amountCents).toBe(2000);
  });

  it("sets settledUp: true when preset amount is paid in full", async () => {
    renderAndSelectBob(); // BOB_DEBT is 4250 cents, amount pre-filled as $42.50
    await act(async () => { fireEvent.submit(getForm()); });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.settledUp).toBe(true);
    expect((onOptimisticActivity.mock.calls[0][0].payload as Record<string, unknown>).settledUp).toBe(true);
    expect(onOptimisticAdd.mock.calls[0][0].settledUp).toBe(true);
  });

  it("sets settledUp: false when paying a partial amount", async () => {
    renderAndSelectBob();
    fireEvent.change(getAmountInput(), { target: { value: "20.00" } }); // less than $42.50
    await act(async () => { fireEvent.submit(getForm()); });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.settledUp).toBe(false);
    expect((onOptimisticActivity.mock.calls[0][0].payload as Record<string, unknown>).settledUp).toBe(false);
    expect(onOptimisticAdd.mock.calls[0][0].settledUp).toBe(false);
  });

  it("modal closes immediately after submit (before fetch resolves)", async () => {
    renderAndSelectBob();
    await act(async () => { fireEvent.submit(getForm()); });
    expect(document.querySelector(".modal-backdrop")).toBeNull();
  });

  it("reopening after submission starts at pick step", async () => {
    renderAndSelectBob();
    await act(async () => { fireEvent.submit(getForm()); });
    openModal();
    expect(screen.getByRole("heading", { name: /settle up/i })).toBeTruthy();
    expect(screen.queryByText("Pay Bob")).toBeNull();
  });

  it("calls onSettled after fetch resolves", async () => {
    renderAndSelectBob();
    await act(async () => { fireEvent.submit(getForm()); });
    expect(onSettled).toHaveBeenCalledOnce();
  });
});

// ─── Submission: free-form ("Record other payment") ──────────────────────────

describe("RecordPaymentForm — Submission (Record other payment mode)", () => {
  let onOptimisticAdd: Mock<(expense: ExpenseRow) => void>;

  beforeEach(() => {
    onOptimisticAdd = vi.fn<(expense: ExpenseRow) => void>();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits with the From dropdown selection as paidById", async () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={[]}
        onOptimisticAdd={onOptimisticAdd}
        onSettled={vi.fn()}
        onOptimisticActivity={vi.fn()}
      />
    );
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    // Change "From" to Bob
    const fromSelect = screen.getByLabelText(/from \(who sent money\)/i) as HTMLSelectElement;
    fireEvent.change(fromSelect, { target: { value: "user-b" } });
    // Enter amount
    fireEvent.change(getAmountInput(), { target: { value: "15.00" } });
    await act(async () => { fireEvent.submit(getForm()); });

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.paidById).toBe("user-b");
    expect(body.amountCents).toBe(1500);
  });
});

// ─── Amount validation ────────────────────────────────────────────────────────

describe("RecordPaymentForm — Amount validation", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function goToFreeFormStep() {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
  }

  it("empty amount on submit shows error and does not call fetch", async () => {
    goToFreeFormStep();
    await act(async () => { fireEvent.submit(getForm()); });
    expect(screen.getByText(/please enter a valid amount greater than zero/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("zero amount on submit shows error and does not call fetch", async () => {
    goToFreeFormStep();
    fireEvent.change(getAmountInput(), { target: { value: "0" } });
    await act(async () => { fireEvent.submit(getForm()); });
    expect(screen.getByText(/please enter a valid amount greater than zero/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("amount exceeding max on blur shows error message", () => {
    goToFreeFormStep();
    fireEvent.change(getAmountInput(), { target: { value: "100001" } });
    fireEvent.blur(getAmountInput());
    expect(screen.getByText(/amount cannot exceed/i)).toBeTruthy();
  });

  it("amount exceeding max on submit shows error and does not call fetch", async () => {
    goToFreeFormStep();
    fireEvent.change(getAmountInput(), { target: { value: "100001" } });
    await act(async () => { fireEvent.submit(getForm()); });
    expect(screen.getByText(/amount cannot exceed/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("valid amount on blur clears error and formats to 2 decimal places", () => {
    goToFreeFormStep();
    // Trigger an error first
    fireEvent.change(getAmountInput(), { target: { value: "0" } });
    fireEvent.blur(getAmountInput());
    expect(screen.getByText(/please enter a valid amount/i)).toBeTruthy();
    // Now enter a valid amount and blur
    fireEvent.focus(getAmountInput());
    fireEvent.change(getAmountInput(), { target: { value: "42.5" } });
    fireEvent.blur(getAmountInput());
    expect(screen.queryByText(/please enter a valid amount/i)).toBeNull();
    expect(getAmountInput().value).toBe("42.50");
  });

  it("typing after a validation error clears the error message", () => {
    goToFreeFormStep();
    // Trigger error via submit
    fireEvent.change(getAmountInput(), { target: { value: "" } });
    fireEvent.blur(getAmountInput());
    expect(screen.getByText(/please enter a valid amount/i)).toBeTruthy();
    // Start typing
    fireEvent.change(getAmountInput(), { target: { value: "1" } });
    expect(screen.queryByText(/please enter a valid amount/i)).toBeNull();
  });
});

// ─── Hint text ────────────────────────────────────────────────────────────────

describe("RecordPaymentForm — Hint text in preset mode", () => {
  it("shows partial-payment hint in preset mode", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    expect(screen.getByText(/full balance owed.*you can pay a partial amount/i)).toBeTruthy();
  });

  it("hides partial-payment hint when a validation error is active", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[BOB_DEBT]} />);
    openModal();
    clickDebtRow("Bob");
    // Trigger validation error by clearing and blurring
    fireEvent.focus(getAmountInput());
    fireEvent.change(getAmountInput(), { target: { value: "" } });
    fireEvent.blur(getAmountInput());
    expect(screen.getByText(/please enter a valid amount/i)).toBeTruthy();
    expect(screen.queryByText(/full balance owed/i)).toBeNull();
  });

  it("does not show partial-payment hint in 'Record other payment' mode", () => {
    render(<RecordPaymentForm {...BASE_PROPS} userOwesDebts={[]} />);
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    expect(screen.queryByText(/full balance owed/i)).toBeNull();
  });
});

