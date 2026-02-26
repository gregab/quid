import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createTestQueryClient, makeGroupDetail } from "../../../../lib/test-utils";

// Must mock lucide at test level to prevent loading react-native-svg
vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  Check: () => null,
}));

// Mock DateTimePicker
vi.mock("@react-native-community/datetimepicker", () => ({
  default: () => null,
}));

// Mock safe area
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import AddExpenseScreen from "./add-expense";

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

vi.mock("../../../../lib/queries", () => ({
  useGroupDetail: () => mockUseGroupDetail(),
  useCreateExpense: () => ({
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
  mockMutateAsync.mockResolvedValue({});
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AddExpenseScreen />
    </QueryClientProvider>,
  );
}

describe("AddExpenseScreen", () => {
  it("renders form fields via ExpenseForm", () => {
    renderWithProviders();
    expect(screen.getByPlaceholderText("What's this for?")).toBeTruthy();
    expect(screen.getByPlaceholderText("0.00")).toBeTruthy();
  });

  it("shows loading state when group is loading", () => {
    mockUseGroupDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderWithProviders();
    expect(screen.queryByText("Add expense")).toBeNull();
  });

  it("renders header with title and cancel button", () => {
    renderWithProviders();
    expect(screen.getAllByText("Add expense").length).toBeGreaterThan(0);
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("renders member selection for paid-by", () => {
    renderWithProviders();
    expect(screen.getByText("Paid by")).toBeTruthy();
    expect(screen.getAllByText(/Alice W/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bob S/).length).toBeGreaterThan(0);
  });

  it("renders split type options", () => {
    renderWithProviders();
    expect(screen.getByText("Split type")).toBeTruthy();
    expect(screen.getByText("Equal")).toBeTruthy();
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText("%")).toBeTruthy();
  });

  it("shows recurring toggle", () => {
    renderWithProviders();
    expect(screen.getByText("Recurring expense")).toBeTruthy();
  });

  it("submits with correct payload including splitType", async () => {
    renderWithProviders();

    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "50.00" },
    });
    fireEvent.change(screen.getByPlaceholderText("What's this for?"), {
      target: { value: "Pizza" },
    });

    const submitBtn = screen.getAllByText("Add expense").at(-1)!;
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "group-1",
        description: "Pizza",
        amountCents: 5000,
        splitType: "equal",
      }),
    );
  });
});
