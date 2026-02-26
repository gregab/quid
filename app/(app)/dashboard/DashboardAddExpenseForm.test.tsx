// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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

// Mock AddExpenseForm — we test the friend picker wrapper, not the inner form
vi.mock("@/app/(app)/groups/[id]/AddExpenseForm", () => ({
  AddExpenseForm: vi.fn(({ members, onCustomSubmit, renderTrigger }: {
    members: Array<{ userId: string; displayName: string }>;
    onCustomSubmit: (data: unknown) => Promise<void>;
    renderTrigger: (props: { onClick: () => void }) => React.ReactNode;
  }) => (
    <div data-testid="add-expense-form">
      {renderTrigger({ onClick: () => {} })}
      <div data-testid="form-members">
        {members.map((m) => m.displayName).join(",")}
      </div>
      <button
        data-testid="mock-submit"
        onClick={() => onCustomSubmit({
          description: "Test",
          amountCents: 1000,
          date: "2026-02-25",
          paidById: "user-1",
          participantIds: members.map((m) => m.userId),
          splitType: "equal" as const,
        })}
      >
        Submit
      </button>
    </div>
  )),
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

const defaultProps = {
  currentUserId: "user-1",
  currentUserDisplayName: "Alice",
  contacts,
};

describe("DashboardAddExpenseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Add expense trigger button", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    expect(screen.getByText("Add expense")).toBeTruthy();
  });

  it("opens friend picker modal on button click", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText("Add friend expense")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search friends...")).toBeTruthy();
  });

  it("shows no contacts message when contacts array is empty", () => {
    render(<DashboardAddExpenseForm {...defaultProps} contacts={[]} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText(/No contacts yet/)).toBeTruthy();
  });

  it("filters contacts by search query", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.change(searchInput, { target: { value: "Bob" } });

    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.queryByText("Carol J.")).toBeNull();
    expect(screen.queryByText("Dave L.")).toBeNull();
  });

  it("adds a friend as a chip when clicked in dropdown", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.focus(searchInput);
    fireEvent.click(screen.getByText("Bob S."));

    // Bob should appear as a chip (not in the dropdown anymore)
    // The chip has a remove button with aria-label
    expect(screen.getByLabelText("Remove Bob S.")).toBeTruthy();
  });

  it("removes a friend chip when X is clicked", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Add Bob
    fireEvent.focus(screen.getByPlaceholderText("Search friends..."));
    fireEvent.click(screen.getByText("Bob S."));

    // Remove Bob
    fireEvent.click(screen.getByLabelText("Remove Bob S."));
    expect(screen.queryByLabelText("Remove Bob S.")).toBeNull();
  });

  it("supports adding multiple friends", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Add Bob
    fireEvent.focus(screen.getByPlaceholderText("Search friends..."));
    fireEvent.click(screen.getByText("Bob S."));

    // Add Carol (she should still be in the dropdown since Bob was already selected)
    const searchInput = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(searchInput);
    fireEvent.click(screen.getByText("Carol J."));

    expect(screen.getByLabelText("Remove Bob S.")).toBeTruthy();
    expect(screen.getByLabelText("Remove Carol J.")).toBeTruthy();
  });

  it("hides already-selected friends from dropdown", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Add Bob
    fireEvent.focus(screen.getByPlaceholderText("Search friends..."));
    fireEvent.click(screen.getByText("Bob S."));

    // Reopen dropdown — Bob should not appear
    const searchInput = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "" } });

    // Carol and Dave should appear, but not Bob
    expect(screen.getByText("Carol J.")).toBeTruthy();
    expect(screen.getByText("Dave L.")).toBeTruthy();
    // Bob only appears as a chip, not in the dropdown
    const bobElements = screen.queryAllByText("Bob S.");
    // Should be exactly 1 (the chip)
    expect(bobElements.length).toBe(1);
  });

  it("prevents proceeding without selecting a friend", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Next button should be disabled
    const nextButton = screen.getByText("Next");
    expect((nextButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("proceeds to AddExpenseForm after selecting friends and clicking Next", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Add Bob
    fireEvent.focus(screen.getByPlaceholderText("Search friends..."));
    fireEvent.click(screen.getByText("Bob S."));

    // Click Next
    fireEvent.click(screen.getByText("Next"));

    // Should now show the mocked AddExpenseForm
    expect(screen.getByTestId("add-expense-form")).toBeTruthy();
    // Members should include Alice (current user) and Bob
    expect(screen.getByTestId("form-members").textContent).toBe("Alice,Bob Smith");
  });

  it("supports keyboard navigation in typeahead", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search friends...");
    fireEvent.focus(searchInput);

    // Arrow down to Carol (index 1), then Enter
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    // Carol should be added as chip
    expect(screen.getByLabelText("Remove Carol J.")).toBeTruthy();
  });

  it("removes last chip with Backspace when search is empty", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Add Bob then Carol
    fireEvent.focus(screen.getByPlaceholderText("Search friends..."));
    fireEvent.click(screen.getByText("Bob S."));
    const searchInput = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.focus(searchInput);
    fireEvent.click(screen.getByText("Carol J."));

    // Backspace should remove Carol (last added)
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryByLabelText("Remove Carol J.")).toBeNull();
    expect(screen.getByLabelText("Remove Bob S.")).toBeTruthy();
  });

  it("calls friends API with correct payload on submit", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { createdCount: 1, friendGroupIds: ["g1"] }, error: null }),
    });

    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Add Bob
    fireEvent.focus(screen.getByPlaceholderText("Search friends..."));
    fireEvent.click(screen.getByText("Bob S."));

    // Next
    fireEvent.click(screen.getByText("Next"));

    // The mocked AddExpenseForm has a submit button
    await fireEvent.click(screen.getByTestId("mock-submit"));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/expenses",
      expect.objectContaining({ method: "POST" }),
    );

    const callArgs = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(callArgs[1].body) as Record<string, unknown>;
    expect(body.friendIds).toEqual(["friend-1"]);
    expect(body.description).toBe("Test");
    expect(body.amountCents).toBe(1000);
  });
});
