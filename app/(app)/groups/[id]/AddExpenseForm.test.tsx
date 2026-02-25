// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { AddExpenseForm } from "./AddExpenseForm";
import type { Member } from "./ExpensesList";

afterEach(cleanup);

// Mock fetch globally
const mockFetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
);
vi.stubGlobal("fetch", mockFetch);

const currentUserId = "user-1";
const currentUserDisplayName = "Alice";

const twoMembers: Member[] = [
  { userId: "user-1", displayName: "Alice" },
  { userId: "user-2", displayName: "Bob" },
];

const threeMembers: Member[] = [
  { userId: "user-1", displayName: "Alice" },
  { userId: "user-2", displayName: "Bob" },
  { userId: "user-3", displayName: "Charlie" },
];

function renderForm(members: Member[] = twoMembers, overrides = {}) {
  const props = {
    groupId: "group-1",
    currentUserId,
    currentUserDisplayName,
    members,
    onOptimisticAdd: vi.fn(),
    onSettled: vi.fn(),
    onOptimisticActivity: vi.fn(),
    ...overrides,
  };
  return { ...render(<AddExpenseForm {...props} />), ...props };
}

// matchMedia mock for isMobile detection
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Helper to open the modal (clicks the trigger button — the first "Add expense")
function openModal() {
  const buttons = screen.getAllByText("Add expense");
  fireEvent.click(buttons[0]!);
}

// Helper to enter an amount (required before navigating to split options)
function enterAmount(value = "20.00") {
  fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value } });
}

describe("AddExpenseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia(false); // Default: desktop
  });

  describe("Desktop modal", () => {
    it("renders all form fields when opened", () => {
      renderForm();
      openModal();

      expect(screen.getByText("Add an expense")).toBeDefined();
      expect(screen.getByLabelText("Description")).toBeDefined();
      expect(screen.getByLabelText("Amount")).toBeDefined();
      expect(screen.getByText("Date")).toBeDefined();
      expect(screen.getByText("Paid by")).toBeDefined();
      expect(screen.getByText("Split between")).toBeDefined();
      expect(screen.getByText("Repeat")).toBeDefined();
    });

    it("closes when Cancel is clicked", () => {
      renderForm();
      openModal();
      expect(screen.getByText("Add an expense")).toBeDefined();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("Add an expense")).toBeNull();
    });

    it("submits successfully with description and amount", async () => {
      const { onOptimisticAdd, onOptimisticActivity } = renderForm();
      openModal();

      fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Test expense" } });
      fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "20.00" } });

      const form = document.querySelector("form")!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onOptimisticAdd).toHaveBeenCalledTimes(1);
      expect(onOptimisticActivity).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/groups/group-1/expenses",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("shows amount validation error for invalid input", () => {
      renderForm();
      openModal();

      const amountInput = screen.getByLabelText("Amount");
      fireEvent.change(amountInput, { target: { value: "abc" } });
      fireEvent.blur(amountInput);

      expect(screen.getByText("Please enter a valid amount greater than zero.")).toBeDefined();
    });

    it("does not show mobile summary pill on desktop", () => {
      renderForm();
      openModal();

      expect(screen.queryByTestId("split-summary-pill")).toBeNull();
    });
  });

  describe("Mobile modal", () => {
    beforeEach(() => {
      mockMatchMedia(true); // Mobile viewport
    });

    it("renders quick-entry screen as full-screen takeover", () => {
      renderForm();
      openModal();

      expect(screen.getByText("Add an expense")).toBeDefined();
      expect(screen.getByLabelText("Description")).toBeDefined();
      expect(screen.getByPlaceholderText("0.00")).toBeDefined();
      expect(screen.getByText("Today")).toBeDefined();
    });

    it("shows split summary pill with default text", () => {
      renderForm();
      openModal();

      const pill = screen.getByTestId("split-summary-pill");
      expect(pill.textContent).toContain("Paid by you, split equally");
    });

    it("navigates to split-options when summary pill is tapped", () => {
      renderForm();
      openModal();
      enterAmount();

      fireEvent.click(screen.getByTestId("split-summary-pill"));
      expect(screen.getByText("Split options")).toBeDefined();
    });

    it("shows amount required nudge when pill tapped without amount", () => {
      renderForm();
      openModal();

      fireEvent.click(screen.getByTestId("split-summary-pill"));
      // Should NOT navigate — should show nudge instead
      expect(screen.queryByText("Split options")).toBeNull();
      expect(screen.getByText("Enter an amount before choosing how to split")).toBeDefined();
    });

    it("navigates back from split-options to quick-entry", () => {
      renderForm();
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      expect(screen.getByText("Split options")).toBeDefined();

      // Click the back arrow (first button in the header)
      const header = screen.getByText("Split options").parentElement!;
      const backBtn = header.querySelector("button")!;
      fireEvent.click(backBtn);

      expect(screen.getByText("Add an expense")).toBeDefined();
    });

    it("navigates to advanced-split from split-options", () => {
      renderForm();
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));

      fireEvent.click(screen.getByText("More options..."));
      expect(screen.getByText("Advanced options")).toBeDefined();
    });

    it("navigates back from advanced-split to split-options", () => {
      renderForm();
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      fireEvent.click(screen.getByText("More options..."));
      expect(screen.getByText("Advanced options")).toBeDefined();

      const header = screen.getByText("Advanced options").parentElement!;
      const backBtn = header.querySelector("button")!;
      fireEvent.click(backBtn);

      expect(screen.getByText("Split options")).toBeDefined();
    });

    it("submits from quick-entry screen with defaults", async () => {
      const { onOptimisticAdd } = renderForm();
      openModal();

      fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Lunch" } });
      fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "30.00" } });

      const form = document.querySelector("form")!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onOptimisticAdd).toHaveBeenCalledTimes(1);
      const addedExpense = onOptimisticAdd.mock.calls[0]![0];
      expect(addedExpense.description).toBe("Lunch");
      expect(addedExpense.amountCents).toBe(3000);
      expect(addedExpense.splitType).toBe("equal");
    });

    it("disables Add expense button until description and amount entered", () => {
      renderForm();
      openModal();

      const submitBtn = screen.getAllByText("Add expense").find(
        (el) => el.tagName === "BUTTON" && el.closest("form")
      ) as HTMLButtonElement;

      // Both empty — disabled
      expect(submitBtn.disabled).toBe(true);

      // Only description — still disabled
      fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Lunch" } });
      expect(submitBtn.disabled).toBe(true);

      // Both filled — enabled
      enterAmount("15.00");
      expect(submitBtn.disabled).toBe(false);
    });

    it("closes when X button is tapped on quick-entry", () => {
      renderForm();
      openModal();
      expect(screen.getByText("Add an expense")).toBeDefined();

      // Find the close button (X) in the header
      const header = screen.getByText("Add an expense").parentElement!;
      const closeBtn = header.querySelector("button")!;
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId("split-summary-pill")).toBeNull();
    });
  });

  describe("2-person presets", () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it("shows 4 preset cards for 2-person groups", () => {
      renderForm(twoMembers);
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));

      expect(screen.getByTestId("preset-you-paid-equal")).toBeDefined();
      expect(screen.getByTestId("preset-you-owed-full")).toBeDefined();
      expect(screen.getByTestId("preset-other-paid-equal")).toBeDefined();
      expect(screen.getByTestId("preset-other-owed-full")).toBeDefined();
    });

    it("applies 'you paid, split equally' preset and returns to quick-entry", () => {
      renderForm(twoMembers);
      openModal();

      fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20.00" } });
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      fireEvent.click(screen.getByTestId("preset-you-paid-equal"));

      // Should navigate back to quick-entry
      expect(screen.getByText("Add an expense")).toBeDefined();
      const pill = screen.getByTestId("split-summary-pill");
      expect(pill.textContent).toContain("Paid by you, split equally");
    });

    it("applies 'other paid, split equally' preset and updates summary", () => {
      renderForm(twoMembers);
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      fireEvent.click(screen.getByTestId("preset-other-paid-equal"));

      const pill = screen.getByTestId("split-summary-pill");
      expect(pill.textContent).toContain("Paid by Bob, split equally");
    });

    it("applies 'you owed full amount' preset as custom split", () => {
      renderForm(twoMembers);
      openModal();
      enterAmount("50.00");
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      fireEvent.click(screen.getByTestId("preset-you-owed-full"));

      const pill = screen.getByTestId("split-summary-pill");
      expect(pill.textContent).toContain("Paid by you, Bob owes the full amount");
    });

    it("shows owes amounts on preset cards when amount is entered", () => {
      renderForm(twoMembers);
      openModal();
      fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20.00" } });
      fireEvent.click(screen.getByTestId("split-summary-pill"));

      const equalPreset = screen.getByTestId("preset-you-paid-equal");
      expect(equalPreset.textContent).toContain("Bob owes you $10.00");

      const fullPreset = screen.getByTestId("preset-you-owed-full");
      expect(fullPreset.textContent).toContain("Bob owes you $20.00");
    });
  });

  describe("3+ person split options", () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it("shows member list instead of presets for 3+ members", () => {
      renderForm(threeMembers);
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));

      // Should not show preset cards
      expect(screen.queryByTestId("preset-you-paid-equal")).toBeNull();

      // Should show Paid by dropdown with all members
      expect(screen.getByText("Paid by")).toBeDefined();
      const paidBySelect = screen.getByDisplayValue("Alice (you)") as HTMLSelectElement;
      expect(paidBySelect.tagName).toBe("SELECT");
      expect(paidBySelect.options).toHaveLength(3);

      // Should show member checklist
      expect(screen.getByText("Split between")).toBeDefined();
    });

    it("allows changing payer via dropdown for 3+ members", () => {
      renderForm(threeMembers);
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));

      const paidBySelect = screen.getByDisplayValue("Alice (you)") as HTMLSelectElement;
      fireEvent.change(paidBySelect, { target: { value: "user-2" } });
      expect(paidBySelect.value).toBe("user-2");

      // Go back and check summary reflects the change
      fireEvent.click(screen.getByText("Done"));
      expect(screen.getByTestId("split-summary-pill").textContent).toContain("Paid by Bob");
    });

    it("Done button returns to quick-entry", () => {
      renderForm(threeMembers);
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));

      fireEvent.click(screen.getByText("Done"));
      expect(screen.getByText("Add an expense")).toBeDefined();
    });
  });

  describe("Summary text generation", () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it("shows default summary for equal split by current user", () => {
      renderForm();
      openModal();
      const pill = screen.getByTestId("split-summary-pill");
      expect(pill.textContent).toContain("Paid by you, split equally");
    });

    it("updates summary when paid-by changes via preset", () => {
      renderForm(twoMembers);
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      fireEvent.click(screen.getByTestId("preset-other-paid-equal"));
      const pill = screen.getByTestId("split-summary-pill");
      expect(pill.textContent).toContain("Paid by Bob, split equally");
    });
  });

  describe("Advanced screen (mobile)", () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it("shows paid-by dropdown, split section, and recurring toggle", () => {
      renderForm();
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      fireEvent.click(screen.getByText("More options..."));

      expect(screen.getByText("Advanced options")).toBeDefined();
      expect(screen.getByText("Paid by")).toBeDefined();
      expect(screen.getByText("Split between")).toBeDefined();
      expect(screen.getByText("Repeat")).toBeDefined();
    });

    it("Done button on advanced screen returns to quick-entry", () => {
      renderForm();
      openModal();
      enterAmount();
      fireEvent.click(screen.getByTestId("split-summary-pill"));
      fireEvent.click(screen.getByText("More options..."));

      fireEvent.click(screen.getByText("Done"));
      expect(screen.getByText("Add an expense")).toBeDefined();
    });
  });
});
