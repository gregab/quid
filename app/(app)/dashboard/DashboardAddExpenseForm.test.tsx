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
    expect(screen.getByText("Add friend expense")).toBeTruthy();
  });

  it("shows typeahead search input when no friend selected", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByPlaceholderText("Search friends...")).toBeTruthy();
  });

  it("filters contacts by search query", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.change(searchInput, { target: { value: "Bob" } });

    // Bob should appear, Carol and Dave should not
    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.queryByText("Carol J.")).toBeNull();
    expect(screen.queryByText("Dave L.")).toBeNull();
  });

  it("selects a friend from typeahead dropdown", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Focus the search to open the dropdown
    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.focus(searchInput);

    // Click on Bob
    fireEvent.click(screen.getByText("Bob S."));

    // Search input should be gone, Bob should be shown as selected
    expect(screen.queryByPlaceholderText("Search friends...")).toBeNull();
    // Bob S. should appear in selected chip and paid-by selector
    expect(screen.getAllByText("Bob S.").length).toBeGreaterThanOrEqual(1);
    // Paid by selector should show "You" and "Bob S."
    expect(screen.getByText("Paid by")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("can clear selected friend and go back to search", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Select Bob
    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.focus(searchInput);
    fireEvent.click(screen.getByText("Bob S."));

    // Clear the selection
    const removeButton = screen.getByLabelText("Remove friend");
    fireEvent.click(removeButton);

    // Search input should be back
    expect(screen.getByPlaceholderText("Search friends...")).toBeTruthy();
  });

  it("shows payer selector when friend is selected", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Select Bob
    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.focus(searchInput);
    fireEvent.click(screen.getByText("Bob S."));

    // Payer selector should show "You" and "Bob S."
    expect(screen.getByText("Paid by")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    // Bob appears in selected area and paid-by selector
    const bobElements = screen.getAllByText("Bob S.");
    expect(bobElements.length).toBeGreaterThanOrEqual(2);
  });

  it("shows error when submitting without selecting a friend", async () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // The submit button should be disabled when no friend is selected
    const addButton = screen.getAllByText("Add expense");
    const submitButton = addButton[addButton.length - 1]!;
    expect((submitButton.closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits with correct payload for 1 friend", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { createdCount: 1, friendGroupIds: ["g1"] }, error: null }),
    });

    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Select friend via typeahead
    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.focus(searchInput);
    fireEvent.click(screen.getByText("Bob S."));

    // Fill in description
    const descInput = screen.getByPlaceholderText("Dinner, groceries, etc.");
    fireEvent.change(descInput, { target: { value: "Coffee" } });

    // Fill in amount
    const amountInput = screen.getByPlaceholderText("0.00");
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

  it("supports keyboard navigation in typeahead", () => {
    render(<DashboardAddExpenseForm currentUserId="user-1" contacts={contacts} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.focus(searchInput);

    // Press ArrowDown to highlight second item, then Enter to select
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    // Carol (index 1) should be selected — appears in selected chip and paid-by
    expect(screen.getAllByText("Carol J.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Paid by")).toBeTruthy();
  });
});
