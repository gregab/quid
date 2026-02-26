// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DashboardAddExpenseForm } from "./DashboardAddExpenseForm";
import type { DashboardContact, DashboardGroup } from "./DashboardAddExpenseForm";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: mockRefresh,
  })),
}));

// Mock AddExpenseForm — we test the friend/group picker wrapper, not the inner form
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

const groups: DashboardGroup[] = [
  {
    id: "group-1",
    name: "Apartment",
    members: [
      { userId: "user-1", displayName: "Alice" },
      { userId: "friend-1", displayName: "Bob Smith" },
    ],
  },
  {
    id: "group-2",
    name: "Road Trip",
    members: [
      { userId: "user-1", displayName: "Alice" },
      { userId: "friend-2", displayName: "Carol Jones" },
    ],
  },
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

  it("opens picker modal with updated title on button click", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText("Add expense", { selector: "h2" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search groups and friends...")).toBeTruthy();
  });

  it("shows join group message when no contacts and no groups", () => {
    render(<DashboardAddExpenseForm {...defaultProps} contacts={[]} groups={[]} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText(/Join a group to start adding expenses/)).toBeTruthy();
  });

  it("shows all contacts in the list", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.getByText("Carol J.")).toBeTruthy();
    expect(screen.getByText("Dave L.")).toBeTruthy();
  });

  it("filters contacts by search query", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search groups and friends...");
    fireEvent.change(searchInput, { target: { value: "Bob" } });

    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.queryByText("Carol J.")).toBeNull();
    expect(screen.queryByText("Dave L.")).toBeNull();
  });

  it("shows no matches message when search has no results", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search groups and friends...");
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });

    expect(screen.getByText("No matches found")).toBeTruthy();
  });

  it("proceeds directly to AddExpenseForm when a friend is clicked", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));
    fireEvent.click(screen.getByText("Bob S."));

    // Should now show the mocked AddExpenseForm
    expect(screen.getByTestId("add-expense-form")).toBeTruthy();
    // Members should include Alice (current user) and Bob
    expect(screen.getByTestId("form-members").textContent).toBe("Alice,Bob Smith");
  });

  it("supports keyboard navigation: ArrowDown + Enter selects a friend (no groups)", () => {
    render(<DashboardAddExpenseForm {...defaultProps} groups={[]} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search groups and friends...");

    // ArrowDown to Carol (index 1), then Enter
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    // Carol should be selected → form opens
    expect(screen.getByTestId("add-expense-form")).toBeTruthy();
    expect(screen.getByTestId("form-members").textContent).toBe("Alice,Carol Jones");
  });

  it("closes modal on Escape", () => {
    render(<DashboardAddExpenseForm {...defaultProps} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search groups and friends...");
    fireEvent.keyDown(searchInput, { key: "Escape" });

    expect(screen.queryByRole("heading", { name: "Add expense" })).toBeNull();
  });

  it("calls friends API and onExpenseCreated on friend submit", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { createdCount: 1, friendGroupIds: ["g1"] }, error: null }),
    });

    const onExpenseCreated = vi.fn();
    render(<DashboardAddExpenseForm {...defaultProps} onExpenseCreated={onExpenseCreated} />);
    fireEvent.click(screen.getByText("Add expense"));

    // Select Bob
    fireEvent.click(screen.getByText("Bob S."));

    // The mocked AddExpenseForm has a submit button
    fireEvent.click(screen.getByTestId("mock-submit"));

    // Wait for async handleFriendSubmit to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/friends/expenses",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const callArgs = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(callArgs[1].body) as Record<string, unknown>;
    expect(body.friendIds).toEqual(["friend-1"]);
    expect(body.description).toBe("Test");
    expect(body.amountCents).toBe(1000);

    // onExpenseCreated should have been called with optimistic data
    await waitFor(() => {
      expect(onExpenseCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          friendUserId: "friend-1",
          friendGroupId: "g1",
          amountCents: 1000,
          paidById: "user-1",
          splitType: "equal",
        }),
      );
    });

    // router.refresh should be called for server reconciliation
    expect(mockRefresh).toHaveBeenCalled();
  });

  // ── Group path tests ──────────────────────────────────────────────────────

  it("renders group section when groups are passed", () => {
    render(<DashboardAddExpenseForm {...defaultProps} groups={groups} />);
    fireEvent.click(screen.getByText("Add expense"));
    expect(screen.getByText("Apartment")).toBeTruthy();
    expect(screen.getByText("Road Trip")).toBeTruthy();
  });

  it("clicking a group proceeds to AddExpenseForm with group members", () => {
    render(<DashboardAddExpenseForm {...defaultProps} groups={groups} />);
    fireEvent.click(screen.getByText("Add expense"));
    fireEvent.click(screen.getByText("Apartment"));

    expect(screen.getByTestId("add-expense-form")).toBeTruthy();
    expect(screen.getByTestId("form-members").textContent).toBe("Alice,Bob Smith");
  });

  it("search filters both groups and friends", () => {
    render(<DashboardAddExpenseForm {...defaultProps} groups={groups} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search groups and friends...");
    fireEvent.change(searchInput, { target: { value: "Road" } });

    expect(screen.getByText("Road Trip")).toBeTruthy();
    expect(screen.queryByText("Apartment")).toBeNull();
    // Friends not matching "Road" should also be hidden
    expect(screen.queryByText("Bob S.")).toBeNull();
  });

  it("calls group expenses API on group submit", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "exp-1" }, error: null }),
    });

    render(<DashboardAddExpenseForm {...defaultProps} groups={groups} />);
    fireEvent.click(screen.getByText("Add expense"));
    fireEvent.click(screen.getByText("Apartment"));

    fireEvent.click(screen.getByTestId("mock-submit"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/groups/group-1/expenses",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const callArgs = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(callArgs[1].body) as Record<string, unknown>;
    expect(body.description).toBe("Test");
    expect(body.amountCents).toBe(1000);
  });

  it("calls router.refresh() after group submit", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "exp-1" }, error: null }),
    });

    render(<DashboardAddExpenseForm {...defaultProps} groups={groups} />);
    fireEvent.click(screen.getByText("Add expense"));
    fireEvent.click(screen.getByText("Apartment"));
    fireEvent.click(screen.getByTestId("mock-submit"));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("keyboard Enter on group selects it and opens form", () => {
    render(<DashboardAddExpenseForm {...defaultProps} groups={groups} contacts={[]} />);
    fireEvent.click(screen.getByText("Add expense"));

    const searchInput = screen.getByPlaceholderText("Search groups and friends...");
    // First item (index 0) is Apartment — press Enter
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(screen.getByTestId("add-expense-form")).toBeTruthy();
    expect(screen.getByTestId("form-members").textContent).toBe("Alice,Bob Smith");
  });
});
