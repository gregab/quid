import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createTestQueryClient, makeGroupDetail } from "../../../../lib/test-utils";

// Must mock lucide at test level to prevent loading react-native-svg
vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Check: () => null,
  X: () => null,
  Calendar: () => null,
  SlidersHorizontal: () => null,
}));

// Mock DateTimePicker
vi.mock("@react-native-community/datetimepicker", () => ({
  default: () => null,
}));

// Mock safe area
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
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
const mockRouterBack = vi.fn();
const mockRouterPush = vi.fn();

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
  vi.mocked(useRouter).mockReturnValue({
    back: mockRouterBack,
    push: mockRouterPush,
    navigate: vi.fn(),
    replace: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    canGoBack: vi.fn(() => true),
    setParams: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>);
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
  it("renders amount and description inputs", () => {
    renderWithProviders();
    expect(screen.getByPlaceholderText("0.00")).toBeTruthy();
    expect(screen.getByPlaceholderText("What's it for?")).toBeTruthy();
  });

  it("renders screen title", () => {
    renderWithProviders();
    expect(screen.getByText("Add an expense")).toBeTruthy();
  });

  it("shows loading state when group is loading and members are empty", () => {
    mockUseGroupDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderWithProviders();
    expect(screen.queryByPlaceholderText("0.00")).toBeNull();
  });

  it("renders split options shortcut row", () => {
    renderWithProviders();
    expect(screen.getByText("Split options")).toBeTruthy();
    expect(screen.getByText(/Paid by you/)).toBeTruthy();
  });

  it("renders Add expense button", () => {
    renderWithProviders();
    expect(screen.getAllByText("Add expense").length).toBeGreaterThan(0);
  });

  it("submits with equal split when Add expense is pressed", async () => {
    renderWithProviders();

    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "50.00");
    fireEvent.changeText(screen.getByPlaceholderText("What's it for?"), "Pizza");

    const submitBtn = screen.getAllByText("Add expense").at(-1)!;
    await act(async () => {
      fireEvent.press(submitBtn);
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

  it("navigates to split screen when Split options is pressed", async () => {
    renderWithProviders();

    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "30.00");
    fireEvent.changeText(screen.getByPlaceholderText("What's it for?"), "Groceries");

    await act(async () => {
      fireEvent.press(screen.getByText("Split options"));
    });

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          description: "Groceries",
        }),
      }),
    );
  });
});
