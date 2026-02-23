// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RecordPaymentForm } from "./RecordPaymentForm";

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

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /settle up/i }));
}

describe("RecordPaymentForm — Settle Up button", () => {
  it("renders a 'Settle up' button (not 'Record payment')", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={[]}
      />
    );
    expect(screen.getByRole("button", { name: /settle up/i })).toBeTruthy();
    expect(screen.queryByText(/record payment/i)).toBeNull();
  });
});

describe("RecordPaymentForm — Pick step (no debts)", () => {
  it("shows settled-up message and 'Record other payment' when user owes nobody", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={[]}
      />
    );
    openModal();
    expect(screen.getByText(/you're all settled up/i)).toBeTruthy();
    expect(screen.getByText(/record other payment/i)).toBeTruthy();
  });

  it("does not show any debt rows when userOwesDebts is empty", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={[]}
      />
    );
    openModal();
    expect(screen.queryByText("Bob")).toBeNull();
    expect(screen.queryByText("Carol")).toBeNull();
  });
});

describe("RecordPaymentForm — Pick step (with debts)", () => {
  const debts = [
    { toId: "user-b", toName: "Bob", amountCents: 4250 },
    { toId: "user-c", toName: "Carol", amountCents: 1800 },
  ];

  it("shows each person owed with their amount", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("$42.50")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
    expect(screen.getByText("$18.00")).toBeTruthy();
  });

  it("shows 'Record other payment' at the bottom", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    expect(screen.getByText(/record other payment/i)).toBeTruthy();
  });

  it("does not show the settled-up message when user has debts", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    expect(screen.queryByText(/you're all settled up/i)).toBeNull();
  });
});

describe("RecordPaymentForm — Form step via debt selection", () => {
  const debts = [{ toId: "user-b", toName: "Bob", amountCents: 4250 }];

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
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    fireEvent.click(screen.getByText("Bob").closest("button")!);
    expect(screen.getByText("Pay Bob")).toBeTruthy();
  });

  it("pre-populates the amount field with the exact debt amount", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    fireEvent.click(screen.getByText("Bob").closest("button")!);
    const amountInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(amountInput.value).toBe("42.50");
  });

  it("shows locked (non-editable) From and To fields in preset mode", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    fireEvent.click(screen.getByText("Bob").closest("button")!);
    // No dropdowns for From/To in preset mode
    expect(screen.queryByLabelText(/from \(who sent money\)/i)).toBeNull();
    expect(screen.queryByLabelText(/to \(who received money\)/i)).toBeNull();
    // Shows locked display with user name
    expect(screen.getByText(/Alice/)).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("allows modifying the pre-populated amount", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    fireEvent.click(screen.getByText("Bob").closest("button")!);
    const amountInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "20.00" } });
    expect(amountInput.value).toBe("20.00");
  });

  it("back button returns to pick step", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={debts}
      />
    );
    openModal();
    fireEvent.click(screen.getByText("Bob").closest("button")!);
    expect(screen.getByText("Pay Bob")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    // Back to pick step: Bob row visible again
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.queryByText("Pay Bob")).toBeNull();
  });
});

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
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={[]}
      />
    );
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    expect(screen.getByText("Record a payment")).toBeTruthy();
    expect(screen.getByLabelText(/from \(who sent money\)/i)).toBeTruthy();
    expect(screen.getByLabelText(/to \(who received money\)/i)).toBeTruthy();
  });

  it("amount field is empty when entering via 'Record other payment'", () => {
    render(
      <RecordPaymentForm
        {...BASE_PROPS}
        userOwesDebts={[]}
      />
    );
    openModal();
    fireEvent.click(screen.getByText(/record other payment/i));
    const amountInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(amountInput.value).toBe("");
  });
});
