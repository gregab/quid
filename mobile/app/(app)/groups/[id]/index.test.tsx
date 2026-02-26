import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTestQueryClient,
  makeExpense,
  makeGroupDetail,
  makeActivity,
} from "../../../../lib/test-utils";

vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  Settings: () => null,
  Plus: () => null,
  CheckCircle: () => null,
  Link: () => null,
  Share: () => null,
  Repeat: () => null,
  CirclePlus: () => null,
  Pencil: () => null,
  Trash2: () => null,
  XCircle: () => null,
  ArrowDownLeft: () => null,
}));

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
  mockUseActivityLogs.mockReturnValue({
    data: { pages: [] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
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

  it("renders group name and members", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getAllByText("Test Group").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Alice W.")).toBeTruthy();
    expect(screen.getByText("Bob S.")).toBeTruthy();
  });

  it("shows all settled up when no expenses", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("All settled up")).toBeTruthy();
  });

  it("shows empty expenses message", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("No expenses yet. Add one to get started!")).toBeTruthy();
  });

  it("renders expense cards with descriptions", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
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
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
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
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ paidById: "user-1", amountCents: 4000, splits: [{ userId: "user-1", amountCents: 2000 }, { userId: "user-2", amountCents: 2000 }] })],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("you lent $20.00")).toBeTruthy();
  });

  it("renders activity logs with action-specific icons", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    mockUseActivityLogs.mockReturnValue({
      data: { pages: [[makeActivity({ id: "log-1", action: "expense_added", actor: { displayName: "Alice" } })]] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderWithProviders();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getByText(/Expense added/)).toBeTruthy();
    expect(screen.getByTestId("expense_added-icon")).toBeTruthy();
  });

  it("shows no activity message when empty", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("No activity yet.")).toBeTruthy();
  });

  it("shows 'Load more' button when hasNextPage", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    mockUseActivityLogs.mockReturnValue({
      data: { pages: [[makeActivity()]] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });
    renderWithProviders();
    expect(screen.getByText("Load more")).toBeTruthy();
  });

  it("renders floating action bar with 'Settle up' and 'Add' buttons", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("Settle up")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("shows invite members button", () => {
    mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail({ inviteToken: "abc" }), isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    renderWithProviders();
    expect(screen.getByText("Invite members")).toBeTruthy();
  });

  describe("ActivityItem icons", () => {
    function renderWithActivity(action: string) {
      mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
      mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
      mockUseActivityLogs.mockReturnValue({
        data: { pages: [[makeActivity({ id: `log-${action}`, action, actor: { displayName: "Alice" } })]] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
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

    beforeEach(() => {
      mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
    });

    it("shows friend name instead of group name", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false });
      renderWithProviders();
      expect(screen.getAllByText("Bob Smith").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Alice & Bob")).toBeNull();
    });

    it("hides member pills", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false });
      renderWithProviders();
      expect(screen.queryByText("Alice W.")).toBeNull();
      expect(screen.queryByText("Bob S.")).toBeNull();
    });

    it("hides invite link", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false });
      renderWithProviders();
      expect(screen.queryByText("Invite members")).toBeNull();
    });

    it("hides recurring button", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false });
      renderWithProviders();
      expect(screen.queryByText("Recurring")).toBeNull();
    });

    it("still shows settle up and add buttons", () => {
      mockUseGroupDetail.mockReturnValue({ data: friendGroupDetail, isLoading: false });
      renderWithProviders();
      expect(screen.getByText("Settle up")).toBeTruthy();
      expect(screen.getByText("Add")).toBeTruthy();
    });
  });
});
