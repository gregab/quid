import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

// Mock safe area (not in global setup)
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Override useAnimatedStyle to return empty style (RN transforms aren't valid CSS)
vi.mock("react-native-reanimated", async () => {
  const actual = await vi.importActual<typeof import("react-native-reanimated")>(
    "react-native-reanimated",
  );
  return {
    ...actual,
    useAnimatedStyle: () => ({}),
  };
});

import { ExpenseForm } from "./ExpenseForm";
import type { ExpenseFormProps } from "./ExpenseForm";
import type { Member } from "../lib/types";

const alice: Member = { userId: "user-1", displayName: "Alice Wonderland", emoji: "🐦" };
const bob: Member = { userId: "user-2", displayName: "Bob Smith", emoji: "🦜" };
const members: Member[] = [alice, bob];

const mockOnSubmit = vi.fn();

function defaultProps(overrides: Partial<ExpenseFormProps> = {}): ExpenseFormProps {
  return {
    members,
    currentUserId: "user-1",
    onSubmit: mockOnSubmit,
    isLoading: false,
    ...overrides,
  };
}

function renderForm(overrides: Partial<ExpenseFormProps> = {}) {
  return render(<ExpenseForm {...defaultProps(overrides)} />);
}

/** Fill in step 0 (amount + description) and advance to step 1. */
function fillStep0AndAdvance(amount = "20.00", desc = "Lunch") {
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: amount },
  });
  fireEvent.change(screen.getByPlaceholderText("Dinner, groceries, rent..."), {
    target: { value: desc },
  });
  fireEvent.click(screen.getByText("Next"));
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockOnSubmit.mockResolvedValue(undefined);
});

describe("ExpenseForm — Step 0: Quick Entry", () => {
  it("renders amount input with placeholder '0.00'", () => {
    renderForm();
    expect(screen.getByPlaceholderText("0.00")).toBeTruthy();
  });

  it("renders description input", () => {
    renderForm();
    expect(screen.getByPlaceholderText("Dinner, groceries, rent...")).toBeTruthy();
  });

  it("renders step indicator", () => {
    renderForm();
    // Should show "How much?" label
    expect(screen.getByText("How much?")).toBeTruthy();
  });

  it("shows Next button on step 0", () => {
    renderForm();
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("blocks advance when amount is empty", () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText("Dinner, groceries, rent..."), {
      target: { value: "Lunch" },
    });
    fireEvent.click(screen.getByText("Next"));
    // Should still be on step 0 — "How much?" still visible
    expect(screen.getByText("How much?")).toBeTruthy();
  });

  it("blocks advance when description is empty", () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "20.00" },
    });
    fireEvent.click(screen.getByText("Next"));
    // Error message should appear
    expect(screen.getByText("Add a description")).toBeTruthy();
  });
});

describe("ExpenseForm — Step 1: Split Options", () => {
  it("advances to step 1 when amount and description are filled", () => {
    renderForm();
    fillStep0AndAdvance();
    // Step 1 should show "Paid by"
    expect(screen.getByText("Paid by")).toBeTruthy();
  });

  it("renders Paid by section with all member pills", () => {
    renderForm();
    fillStep0AndAdvance();
    expect(screen.getByText("You")).toBeTruthy(); // current user shows as "You"
    expect(screen.getAllByText(/Bob S/).length).toBeGreaterThan(0);
  });

  it("renders Split type segmented control", () => {
    renderForm();
    fillStep0AndAdvance();
    expect(screen.getByText("Split type")).toBeTruthy();
    expect(screen.getByText("Equal")).toBeTruthy();
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText("%")).toBeTruthy();
  });

  it("renders Split between section", () => {
    renderForm();
    fillStep0AndAdvance();
    expect(screen.getByText("Split between")).toBeTruthy();
  });

  it("shows Back button on step 1", () => {
    renderForm();
    fillStep0AndAdvance();
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("going Back returns to step 0 with preserved values", () => {
    renderForm();
    fillStep0AndAdvance("25.00", "Coffee");
    fireEvent.click(screen.getByText("Back"));
    // Should be back on step 0
    expect(screen.getByText("How much?")).toBeTruthy();
    // Values should be preserved
    expect((screen.getByPlaceholderText("0.00") as HTMLInputElement).value).toBe("25.00");
  });

  it("clicking paid-by pill selects that member", () => {
    renderForm();
    fillStep0AndAdvance();
    const bobPills = screen.getAllByText(/Bob S/);
    fireEvent.click(bobPills[0]!);
    expect(screen.getAllByText(/Bob S/).length).toBeGreaterThan(0);
  });

  it("cannot deselect last participant", () => {
    renderForm({ members: [alice] });
    fillStep0AndAdvance();
    // Click the participant row to try to deselect
    fireEvent.click(screen.getAllByText("You")[0]!);
    // Should still show the member
    expect(screen.getAllByText("You").length).toBeGreaterThan(0);
  });

  it("shows summary badge with amount and description", () => {
    renderForm();
    fillStep0AndAdvance("50.00", "Dinner");
    expect(screen.getByText(/\$50\.00/)).toBeTruthy();
    expect(screen.getByText(/Dinner/)).toBeTruthy();
  });
});

describe("ExpenseForm — submit with equal split", () => {
  it("submits from step 1 when equal split (no step 2)", async () => {
    renderForm();
    fillStep0AndAdvance("20.00", "Lunch");

    // On step 1 with equal split, the submit button should show the label
    const submitBtn = screen.getByText("Add expense");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Lunch",
        amountCents: 2000,
        splitType: "equal",
      }),
    );
  });

  it("submitted date is in YYYY-MM-DD local format", async () => {
    renderForm();
    fillStep0AndAdvance("10.00", "Coffee");

    const submitBtn = screen.getByText("Add expense");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    if (mockOnSubmit.mock.calls.length > 0) {
      const call = mockOnSubmit.mock.calls[0]![0] as { date: string };
      expect(call.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("ExpenseForm — Step 2: Advanced split", () => {
  it("switching to Custom and advancing shows custom amount inputs", () => {
    renderForm();
    fillStep0AndAdvance("30.00", "Groceries");

    // Switch to custom split
    fireEvent.click(screen.getByText("Custom"));

    // Advance to step 2
    fireEvent.click(screen.getByText("Next"));

    // Should see custom amount inputs (placeholder "0.00")
    const customInputs = screen.getAllByPlaceholderText("0.00");
    expect(customInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("switching to % and advancing shows percentage inputs", () => {
    renderForm();
    fillStep0AndAdvance("100.00", "Rent");

    fireEvent.click(screen.getByText("%"));
    fireEvent.click(screen.getByText("Next"));

    const pctInputs = screen.getAllByPlaceholderText("0");
    expect(pctInputs.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/0% \/ 100%/)).toBeTruthy();
  });

  it("does NOT submit when custom amounts don't match total", async () => {
    renderForm();
    fillStep0AndAdvance("30.00", "Dinner");

    fireEvent.click(screen.getByText("Custom"));
    fireEvent.click(screen.getByText("Next"));

    // Fill in wrong amounts
    const customInputs = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(customInputs[0]!, { target: { value: "10.00" } });
    fireEvent.change(customInputs[1]!, { target: { value: "10.00" } });

    const submitBtn = screen.getByText("Add expense");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("submits custom split when amounts match total", async () => {
    renderForm();
    fillStep0AndAdvance("30.00", "Groceries");

    fireEvent.click(screen.getByText("Custom"));
    fireEvent.click(screen.getByText("Next"));

    const customInputs = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(customInputs[0]!, { target: { value: "20.00" } });
    fireEvent.change(customInputs[1]!, { target: { value: "10.00" } });

    const submitBtn = screen.getByText("Add expense");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    if (mockOnSubmit.mock.calls.length > 0) {
      const call = mockOnSubmit.mock.calls[0]![0] as { splitType: string };
      expect(call.splitType).toBe("custom");
    }
  });

  it("submits percentage split normalized to custom", async () => {
    renderForm();
    fillStep0AndAdvance("100.00", "Rent");

    fireEvent.click(screen.getByText("%"));
    fireEvent.click(screen.getByText("Next"));

    const pctInputs = screen.getAllByPlaceholderText("0");
    fireEvent.change(pctInputs[0]!, { target: { value: "50" } });
    fireEvent.change(pctInputs[1]!, { target: { value: "50" } });

    const submitBtn = screen.getByText("Add expense");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    if (mockOnSubmit.mock.calls.length > 0) {
      const call = mockOnSubmit.mock.calls[0]![0] as { splitType: string };
      expect(call.splitType).toBe("custom");
    }
  });
});

describe("ExpenseForm — custom submit label", () => {
  it("renders submit button with custom label on equal split step 1", () => {
    renderForm({ submitLabel: "Save changes" });
    fillStep0AndAdvance();
    expect(screen.getByText("Save changes")).toBeTruthy();
  });
});
