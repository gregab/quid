import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTestQueryClient,
  makeExpense,
  makeGroupDetail,
} from "../../../../lib/test-utils";

// Must mock lucide at test level to prevent loading react-native-svg
vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  Link: () => null,
  UserPlus: () => null,
  LogOut: () => null,
}));

import GroupSettingsScreen from "./settings";

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

const mockLeaveAsync = vi.fn();
const mockUseGroupDetail = vi.fn();
const mockUseGroupExpenses = vi.fn();

vi.mock("../../../../lib/queries", () => ({
  useGroupDetail: () => mockUseGroupDetail(),
  useGroupExpenses: () => mockUseGroupExpenses(),
  useLeaveGroup: () => ({
    mutateAsync: mockLeaveAsync,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLocalSearchParams).mockReturnValue({ id: "group-1" });
  mockUseGroupDetail.mockReturnValue({
    data: makeGroupDetail(),
    isLoading: false,
  });
  mockUseGroupExpenses.mockReturnValue({
    data: [],
    isLoading: false,
  });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <GroupSettingsScreen />
    </QueryClientProvider>,
  );
}

describe("GroupSettingsScreen", () => {
  it("renders group name", () => {
    renderWithProviders();
    expect(screen.getByText("Test Group")).toBeTruthy();
    expect(screen.getByText("Group settings")).toBeTruthy();
  });

  it("shows member count", () => {
    renderWithProviders();
    expect(screen.getByText("2 members")).toBeTruthy();
  });

  it("shows loading state", () => {
    mockUseGroupDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderWithProviders();
    expect(screen.queryByText("Group settings")).toBeNull();
  });

  it("renders share invite link action", () => {
    renderWithProviders();
    expect(screen.getByText("Share invite link")).toBeTruthy();
  });

  it("renders add member by email action", () => {
    renderWithProviders();
    expect(screen.getByText("Add member by email")).toBeTruthy();
  });

  it("shows leave group button", () => {
    renderWithProviders();
    expect(screen.getByText("Leave group")).toBeTruthy();
  });

  it("shows outstanding balance warning when user owes money", () => {
    // Expense where user-1 owes user-2
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          paidById: "user-2",
          amountCents: 5000,
          participantIds: ["user-1", "user-2"],
          splits: [
            { userId: "user-1", amountCents: 2500 },
            { userId: "user-2", amountCents: 2500 },
          ],
        }),
      ],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText(/settle up first/)).toBeTruthy();
  });

  it("calls leaveGroup on confirmation when no balance", async () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);
    mockLeaveAsync.mockResolvedValueOnce({ deleted_group: false });

    renderWithProviders();

    await act(async () => {
      fireEvent.click(screen.getByText("Leave group"));
    });

    // Alert mock auto-clicks last button (destructive "Leave")
    expect(mockLeaveAsync).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/(app)/(dashboard)");
  });

  it("shows Back navigation", () => {
    renderWithProviders();
    expect(screen.getByText("Back")).toBeTruthy();
  });
});
