// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { DashboardAddExpenseForm } from "./DashboardAddExpenseForm";
import type { DashboardContact } from "./DashboardAddExpenseForm";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: mockRefresh,
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(cleanup);

const contacts: DashboardContact[] = [
  { userId: "friend-1", displayName: "Bob Smith", avatarUrl: null, emoji: "🐦" },
  { userId: "friend-2", displayName: "Carol Jones", avatarUrl: null, emoji: "🦊" },
  { userId: "friend-3", displayName: "Dave Lee", avatarUrl: null },
];

describe("DashboardAddExpenseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Add expense trigger button", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    expect(screen.getByText("Add expense")).toBeTruthy();
  });

  it("opens modal on button click", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText("Add expense with friends")).toBeTruthy();
  });

  it("shows all contacts as selectable pills", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.getByText("Carol J.")).toBeTruthy();
    expect(screen.getByText("Dave L.")).toBeTruthy();
  });

  it("toggles friend selection", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    const bobPill = screen.getByText("Bob S.");
    fireEvent.click(bobPill);
    // After selection, a checkmark SVG should appear (within the same button)
    const bobButton = bobPill.closest("button")!;
    expect(bobButton.querySelector("svg")).toBeTruthy();

    // Click again to deselect
    fireEvent.click(bobPill);
  });

  it("hides payer selector when multiple friends selected", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Select 2 friends
    fireEvent.click(screen.getByText("Bob S."));
    fireEvent.click(screen.getByText("Carol J."));

    // Payer selector should not be visible
    expect(screen.queryByText("Paid by")).toBeNull();
  });

  it("shows payer selector when exactly 1 friend selected", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Select 1 friend
    fireEvent.click(screen.getByText("Bob S."));

    // Payer selector should show "You" and "Bob S."
    expect(screen.getByText("Paid by")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    // "Bob S." appears as both a contact pill and payer option — find at least 2
    expect(screen.getAllByText("Bob S.").length).toBeGreaterThanOrEqual(2);
  });

  it("shows error when submitting without selecting friends", async () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // The submit button should be disabled when no friends are selected
    const submitButtons = screen.getAllByText("Add expense");
    const submitButton = submitButtons[submitButtons.length - 1]!;
    expect((submitButton.closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits with correct payload for 1 friend", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { createdCount: 1, friendGroupIds: ["g1"] }, error: null }),
    });

    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Select friend
    fireEvent.click(screen.getByText("Bob S."));

    // Fill in description
    const descInput = screen.getByPlaceholderText("Dinner, groceries, etc.");
    fireEvent.change(descInput, { target: { value: "Coffee" } });

    // Fill in amount
    const amountInput = screen.getByPlaceholderText("$0.00");
    fireEvent.change(amountInput, { target: { value: "12.50" } });

    // Submit
    const form = descInput.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/expenses",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const callArgs = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(callArgs[1].body) as Record<string, unknown>;
    expect(body.friendIds).toEqual(["friend-1"]);
    expect(body.description).toBe("Coffee");
    expect(body.amountCents).toBe(1250);
  });

  it("shows no contacts message when contacts array is empty", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={[]} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText(/No contacts yet/)).toBeTruthy();
  });
});
