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
  ChevronRight: () => null,
  CheckCircle: () => null,
  ArrowRight: () => null,
}));

// Mock DateTimePicker
vi.mock("@react-native-community/datetimepicker", () => ({
  default: () => null,
}));

import RecordPaymentScreen from "./record-payment";

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

const mockMutateAsync = vi.fn();
const mockUseGroupDetail = vi.fn();
const mockUseGroupExpenses = vi.fn();

vi.mock("../../../../lib/queries", () => ({
  useGroupDetail: () => mockUseGroupDetail(),
  useGroupExpenses: () => mockUseGroupExpenses(),
  useCreatePayment: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
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
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <RecordPaymentScreen />
    </QueryClientProvider>,
  );
}

describe("RecordPaymentScreen", () => {
  it("shows loading state", () => {
    mockUseGroupDetail.mockReturnValue({ data: undefined, isLoading: true });
    mockUseGroupExpenses.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders();
    expect(screen.queryByText("Settle up")).toBeNull();
  });

  it("shows settle up title in pick step", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("Settle up")).toBeTruthy();
  });

  it("shows all settled up when user has no debts", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("You're all settled up!")).toBeTruthy();
  });

  it("shows debt cards when user owes money", () => {
    // Create an expense where user-1 owes user-2
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          paidById: "user-2",
          paidByDisplayName: "Bob Smith",
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
    expect(screen.getByText("Select a balance to settle.")).toBeTruthy();
    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.getByText("$25.00")).toBeTruthy();
  });

  it("shows Record other payment link", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText(/Record other payment/)).toBeTruthy();
  });

  it("navigates to form step on Record other payment", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderWithProviders();
    fireEvent.click(screen.getByText(/Record other payment/));
    // Header still says "Settle up"; form step shows amount input
    expect(screen.getByPlaceholderText("0.00")).toBeTruthy();
    expect(screen.getByText("Amount")).toBeTruthy();
  });

  it("shows validation error for empty amount", async () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderWithProviders();

    // Go to form step
    fireEvent.click(screen.getByText(/Record other payment/));

    await act(async () => {
      fireEvent.click(screen.getByText("Record payment"));
    });

    expect(
      screen.getByText("Please enter a valid amount greater than zero."),
    ).toBeTruthy();
  });

  it("renders Back button in form step (non-preset)", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderWithProviders();
    fireEvent.click(screen.getByText(/Record other payment/));
    // Non-preset form step shows "Back" to return to pick step
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("shows date section in form step", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderWithProviders();
    fireEvent.click(screen.getByText(/Record other payment/));
    // Date label appears in form step
    expect(screen.getByText("Date")).toBeTruthy();
  });
});
