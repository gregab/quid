import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTestQueryClient,
  makeExpense,
  makeGroupDetail,
  makeActivity,
} from "../../../../lib/test-utils";

// Must mock lucide at test level to prevent loading react-native-svg
vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  Settings: () => null,
  Plus: () => null,
  CheckCircle: () => null,
  Link: () => null,
}));

import GroupDetailScreen from "./index";

// Mock auth
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
    mockUseGroupDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Loading group...")).toBeTruthy();
  });

  it("shows group not found when no group data", () => {
    mockUseGroupDetail.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Group not found")).toBeTruthy();
  });

  it("renders group name and members", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Test Group")).toBeTruthy();
    // Member pills: formatDisplayName abbreviates "Alice Wonderland" → "Alice W."
    expect(screen.getByText("Alice W.")).toBeTruthy();
    expect(screen.getByText("Bob S.")).toBeTruthy();
  });

  it("shows all settled up when no expenses", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("All settled up")).toBeTruthy();
  });

  it("shows empty expenses message", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(
      screen.getByText("No expenses yet. Add one to get started!"),
    ).toBeTruthy();
  });

  it("renders expense cards with descriptions", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          id: "exp-1",
          description: "Dinner",
          amountCents: 6000,
          date: "2026-02-20",
          paidById: "user-1",
          paidByDisplayName: "Alice Wonderland",
        }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("$60.00")).toBeTruthy();
  });

  it("shows payment card with direction", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          id: "pay-1",
          description: "Payment",
          isPayment: true,
          amountCents: 2500,
          paidById: "user-1",
          paidByDisplayName: "Alice Wonderland",
          participantIds: ["user-2"],
          splits: [{ userId: "user-2", amountCents: 2500 }],
        }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Payment")).toBeTruthy();
    expect(screen.getByText("you paid Bob S.")).toBeTruthy();
  });

  it("shows personal context for lent expenses", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          paidById: "user-1",
          amountCents: 4000,
          splits: [
            { userId: "user-1", amountCents: 2000 },
            { userId: "user-2", amountCents: 2000 },
          ],
        }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("you lent $20.00")).toBeTruthy();
  });

  it("renders activity logs", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUseActivityLogs.mockReturnValue({
      data: {
        pages: [
          [
            makeActivity({
              id: "log-1",
              action: "expense_added",
              actor: { displayName: "Alice" },
            }),
          ],
        ],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderWithProviders();
    expect(screen.getByText("Activity")).toBeTruthy();
    // Activity text is split across nested spans: "{actorName} — {title}"
    expect(screen.getByText(/Expense added/)).toBeTruthy();
  });

  it("shows no activity message when empty", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("No activity yet.")).toBeTruthy();
  });

  it("shows 'Load more' button when hasNextPage", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUseActivityLogs.mockReturnValue({
      data: { pages: [[makeActivity()]] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });
    renderWithProviders();
    expect(screen.getByText("Load more")).toBeTruthy();
  });

  it("renders 'Settle up' and 'Add' action buttons", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail(),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Settle up")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("shows share invite link button", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail({ inviteToken: "abc" }),
      isLoading: false,
    });
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Share invite link")).toBeTruthy();
  });
});
