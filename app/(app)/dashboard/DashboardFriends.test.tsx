// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { DashboardFriends } from "./DashboardFriends";
import type { FriendInfo } from "./DashboardFriends";
import type { DashboardContact } from "./DashboardAddExpenseForm";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Capture onExpenseCreated callback from DashboardAddExpenseForm
let capturedOnExpenseCreated: ((expense: {
  friendUserId: string;
  friendGroupId: string;
  amountCents: number;
  paidById: string;
  splitType: "equal" | "custom";
  customSplits?: Array<{ userId: string; amountCents: number }>;
}) => void) | undefined;

vi.mock("./DashboardAddExpenseForm", () => ({
  DashboardAddExpenseForm: vi.fn((props: {
    onExpenseCreated?: typeof capturedOnExpenseCreated;
  }) => {
    capturedOnExpenseCreated = props.onExpenseCreated;
    return <button data-testid="add-expense-btn">Add expense</button>;
  }),
}));

afterEach(cleanup);

const contacts: DashboardContact[] = [
  { userId: "friend-1", displayName: "Bob Smith", avatarUrl: null, emoji: "🐦" },
  { userId: "friend-2", displayName: "Carol Jones", avatarUrl: null },
];

const friends: FriendInfo[] = [
  {
    userId: "friend-1",
    displayName: "Bob Smith",
    avatarUrl: null,
    emoji: "🐦",
    groupId: "group-1",
    balance: 1500,
    hasExpenses: true,
  },
];

const defaultProps = {
  currentUserId: "user-1",
  currentUserDisplayName: "Alice",
  contacts,
  groups: [],
  initialFriends: friends,
};

describe("DashboardFriends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnExpenseCreated = undefined;
  });

  it("renders visible friends with balances", () => {
    render(<DashboardFriends {...defaultProps} />);
    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.getByText("$15.00")).toBeTruthy();
    expect(screen.getByText("you are owed")).toBeTruthy();
  });

  it("shows empty state when no friends have expenses", () => {
    render(<DashboardFriends {...defaultProps} initialFriends={[]} />);
    expect(screen.getByText(/Add an expense with a friend/)).toBeTruthy();
  });

  it("optimistically updates balance when expense is created (user pays)", () => {
    render(<DashboardFriends {...defaultProps} />);

    // Initial balance: +1500 (owed)
    expect(screen.getByText("$15.00")).toBeTruthy();

    // Simulate expense creation: user pays $30, equal split → friend owes +1500 more
    act(() => {
      capturedOnExpenseCreated?.({
        friendUserId: "friend-1",
        friendGroupId: "group-1",
        amountCents: 3000,
        paidById: "user-1",
        splitType: "equal",
      });
    });

    // Balance should now be 1500 + 1500 = 3000 → $30.00
    expect(screen.getByText("$30.00")).toBeTruthy();
    expect(screen.getByText("you are owed")).toBeTruthy();
  });

  it("optimistically updates balance when expense is created (friend pays)", () => {
    render(<DashboardFriends {...defaultProps} />);

    // Simulate expense: friend pays $20, equal split → I owe -1000
    act(() => {
      capturedOnExpenseCreated?.({
        friendUserId: "friend-1",
        friendGroupId: "group-1",
        amountCents: 2000,
        paidById: "friend-1",
        splitType: "equal",
      });
    });

    // Balance should now be 1500 - 1000 = 500 → $5.00
    expect(screen.getByText("$5.00")).toBeTruthy();
  });

  it("adds new friend to list when expense created with unknown friend", () => {
    render(<DashboardFriends {...defaultProps} />);

    // Carol is in contacts but not in friends list yet
    act(() => {
      capturedOnExpenseCreated?.({
        friendUserId: "friend-2",
        friendGroupId: "group-2",
        amountCents: 1000,
        paidById: "user-1",
        splitType: "equal",
      });
    });

    // Carol should now appear in the friends list
    expect(screen.getByText("Carol J.")).toBeTruthy();
    expect(screen.getByText("$5.00")).toBeTruthy();
  });

  it("handles custom splits in optimistic update", () => {
    render(<DashboardFriends {...defaultProps} />);

    act(() => {
      capturedOnExpenseCreated?.({
        friendUserId: "friend-1",
        friendGroupId: "group-1",
        amountCents: 5000,
        paidById: "user-1",
        splitType: "custom",
        customSplits: [
          { userId: "user-1", amountCents: 2000 },
          { userId: "friend-1", amountCents: 3000 },
        ],
      });
    });

    // Balance: 1500 + 3000 (friend's share since user paid) = 4500 → $45.00
    expect(screen.getByText("$45.00")).toBeTruthy();
  });

  it("shows settled state when balance becomes zero", () => {
    const settledFriends: FriendInfo[] = [
      { ...friends[0]!, balance: 1000 },
    ];
    render(<DashboardFriends {...defaultProps} initialFriends={settledFriends} />);

    // Friend pays $20, equal split → I owe -1000, net = 1000 - 1000 = 0
    act(() => {
      capturedOnExpenseCreated?.({
        friendUserId: "friend-1",
        friendGroupId: "group-1",
        amountCents: 2000,
        paidById: "friend-1",
        splitType: "equal",
      });
    });

    expect(screen.getByText("settled")).toBeTruthy();
  });
});
