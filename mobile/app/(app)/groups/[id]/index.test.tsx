import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTestQueryClient,
  makeExpense,
  makeGroupDetail,
  makeActivity,
} from "../../../../lib/test-utils";

// Do NOT mock lucide-react-native — the global vitest.setup.ts Proxy handles all icons

import GroupDetailScreen from "./index";

vi.mock("../../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1", email: "alice@example.com" },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseGroupDetail = vi.fn();
const mockUseGroupExpenses = vi.fn();
const mockUseActivityLogs = vi.fn();

vi.mock("../../../../lib/queries", () => ({
  useGroupDetail: () => mockUseGroupDetail(),
  useGroupExpenses: () => mockUseGroupExpenses(),
  useActivityLogs: () => mockUseActivityLogs(),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLocalSearchParams).mockReturnValue({ id: "group-1" });
  mockUseGroupDetail.mockReturnValue({
    data: makeGroupDetail(),
    isLoading: false,
    refetch: vi.fn(),
  });
  mockUseGroupExpenses.mockReturnValue({
    data: [makeExpense()],
    isLoading: false,
    refetch: vi.fn(),
  });
  mockUseActivityLogs.mockReturnValue({
    data: { pages: [[makeActivity()]] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <GroupDetailScreen />
    </QueryClientProvider>,
  );
}

describe("GroupDetailScreen", () => {
  it("shows loading spinner when data is loading", () => {
    mockUseGroupDetail.mockReturnValue({ data: undefined, isLoading: true });
    mockUseGroupExpenses.mockReturnValue({ data: undefined, isLoading: true, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("Loading group...")).toBeTruthy();
  });

  it("shows group not found when no group data", () => {
    mockUseGroupDetail.mockReturnValue({ data: null, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("Group not found")).toBeTruthy();
  });

  it("renders group name in banner", () => {
    renderWithProviders();
    expect(screen.getByText("Test Group")).toBeTruthy();
  });

  it("renders members as pills", () => {
    renderWithProviders();
    expect(screen.getByText("Alice W.")).toBeTruthy();
    expect(screen.getByText("Bob S.")).toBeTruthy();
  });

  it("shows all settled up when no expenses", () => {
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("All settled up")).toBeTruthy();
  });

  it("shows empty expenses message", () => {
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("No expenses yet. Add one to get started!")).toBeTruthy();
  });

  it("renders expense cards with descriptions", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ id: "exp-1", description: "Dinner", amountCents: 6000, date: "2026-02-20", paidById: "user-1", paidByDisplayName: "Alice Wonderland" })],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("$60.00")).toBeTruthy();
  });

  it("shows payment card with direction", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ id: "pay-1", description: "Payment", isPayment: true, amountCents: 2500, paidById: "user-1", paidByDisplayName: "Alice Wonderland", participantIds: ["user-2"], splits: [{ userId: "user-2", amountCents: 2500 }] })],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Payment")).toBeTruthy();
    expect(screen.getByText("you paid Bob S.")).toBeTruthy();
  });

  it("shows personal context for lent expenses", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ paidById: "user-1", amountCents: 4000, splits: [{ userId: "user-1", amountCents: 2000 }, { userId: "user-2", amountCents: 2000 }] })],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("you lent $20.00")).toBeTruthy();
  });

  // --- Expense type badge tests ---

  it("renders expense type badge for lent expense", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          paidById: "user-1",
          amountCents: 5000,
          splits: [
            { userId: "user-1", amountCents: 2500 },
            { userId: "user-2", amountCents: 2500 },
          ],
        }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByTestId("icon-TrendingUp")).toBeTruthy();
    expect(screen.getByTestId("expense-badge")).toBeTruthy();
  });

  it("renders expense type badge for owed expense", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          paidById: "user-2",
          amountCents: 5000,
          splits: [
            { userId: "user-1", amountCents: 2500 },
            { userId: "user-2", amountCents: 2500 },
          ],
        }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByTestId("icon-TrendingDown")).toBeTruthy();
    expect(screen.getByTestId("expense-badge")).toBeTruthy();
  });

  it("renders payment badge with ArrowUpRight when current user paid", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          isPayment: true,
          paidById: "user-1",
          amountCents: 3000,
          splits: [{ userId: "user-2", amountCents: 3000 }],
        }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByTestId("icon-ArrowUpRight")).toBeTruthy();
  });

  it("renders payment badge with ArrowDownLeft when current user received", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          isPayment: true,
          paidById: "user-2",
          amountCents: 3000,
          splits: [{ userId: "user-1", amountCents: 3000 }],
        }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByTestId("icon-ArrowDownLeft")).toBeTruthy();
  });

  // --- Activity pressable + sheet tests ---

  it("activity items are pressable", () => {
    renderWithProviders();
    const activityItem = screen.getByTestId("activity-item-log-1");
    expect(activityItem).toBeTruthy();
  });

  it("activity sheet shows detail when activity is clicked", async () => {
    renderWithProviders();
    const activityItem = screen.getByTestId("activity-item-log-1");

    await act(async () => {
      fireEvent.click(activityItem);
    });

    // BottomSheetModal mock renders children unconditionally,
    // so the sheet content should appear after state update
    expect(screen.getByTestId("activity-sheet-content")).toBeTruthy();
    expect(screen.getByText("Expense added")).toBeTruthy();
    expect(screen.getByText("Test")).toBeTruthy();
    expect(screen.getByText("$50.00")).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  // --- Activity icon tests ---

  describe("ActivityItem icons", () => {
    function renderWithActivity(action: string) {
      mockUseActivityLogs.mockReturnValue({
        data: { pages: [[makeActivity({ id: `log-${action}`, action, actor: { displayName: "Alice" } })]] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: vi.fn(),
      });
      renderWithProviders();
    }

    it("renders expense_added icon", () => {
      renderWithActivity("expense_added");
      expect(screen.getByTestId("expense_added-icon")).toBeTruthy();
    });

    it("renders expense_edited icon", () => {
      renderWithActivity("expense_edited");
      expect(screen.getByTestId("expense_edited-icon")).toBeTruthy();
    });

    it("renders expense_deleted icon", () => {
      renderWithActivity("expense_deleted");
      expect(screen.getByTestId("expense_deleted-icon")).toBeTruthy();
    });

    it("renders payment_recorded icon", () => {
      renderWithActivity("payment_recorded");
      expect(screen.getByTestId("payment_recorded-icon")).toBeTruthy();
    });

    it("renders payment_deleted icon", () => {
      renderWithActivity("payment_deleted");
      expect(screen.getByTestId("payment_deleted-icon")).toBeTruthy();
    });
  });

  // --- Other UI tests ---

  it("shows 'Load more' button when hasNextPage", () => {
    mockUseActivityLogs.mockReturnValue({
      data: { pages: [[makeActivity()]] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Load more")).toBeTruthy();
  });

  it("renders floating action bar with 'Settle up' and 'Add' buttons", () => {
    renderWithProviders();
    expect(screen.getByText("Settle up")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("shows invite members button", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail({ inviteToken: "abc" }), isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("Invite members")).toBeTruthy();
  });

  it("renders banner with color background", () => {
    renderWithProviders();
    expect(screen.getByTestId("banner-color")).toBeTruthy();
  });

  it("renders back button in banner", () => {
    renderWithProviders();
    expect(screen.getByTestId("banner-back")).toBeTruthy();
  });

  // --- Friend group tests ---

  describe("friend group conditional rendering", () => {
    const friendGroupDetail = makeGroupDetail({
      isFriendGroup: true,
      name: "Alice & Bob",
      inviteToken: "abc",
      GroupMember: [
        { userId: "user-1", User: { displayName: "Alice Wonderland", avatarUrl: null } },
        { userId: "user-2", User: { displayName: "Bob Smith", avatarUrl: null } },
      ],
    });

    it("shows friend name instead of group name", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false, refetch: vi.fn() });
      renderWithProviders();
      expect(screen.getAllByText("Bob Smith").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Alice & Bob")).toBeNull();
    });

    it("hides member pills", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false, refetch: vi.fn() });
      renderWithProviders();
      expect(screen.queryByText("Alice W.")).toBeNull();
      expect(screen.queryByText("Bob S.")).toBeNull();
    });

    it("hides invite link", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false, refetch: vi.fn() });
      renderWithProviders();
      expect(screen.queryByText("Invite members")).toBeNull();
    });

    it("hides recurring button", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false, refetch: vi.fn() });
      renderWithProviders();
      expect(screen.queryByText("Recurring")).toBeNull();
    });

    it("still shows settle up and add buttons", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false, refetch: vi.fn() });
      renderWithProviders();
      expect(screen.getByText("Settle up")).toBeTruthy();
      expect(screen.getByText("Add")).toBeTruthy();
    });
  });
});
