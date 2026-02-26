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
  it("renders form fields", () => {
    renderWithProviders();
    // "Add expense" appears as both heading and button
    expect(screen.getAllByText("Add expense").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("What's this for?")).toBeTruthy();
    expect(screen.getByPlaceholderText("0.00")).toBeTruthy();
  });

  it("shows loading state when group is loading", () => {
    mockUseGroupDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderWithProviders();
    // LoadingSpinner component renders
    expect(screen.queryByText("Add expense")).toBeNull();
  });

  it("renders member selection for paid-by", () => {
    renderWithProviders();
    expect(screen.getByText("Paid by")).toBeTruthy();
    // Members shown: "Alice W. (you)" and "Bob S."
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

  it("disables submit button when description is empty", () => {
    renderWithProviders();

    // Set a valid amount but no description
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "50.00" },
    });

    // "Add expense" appears as heading and button; target the button
    const addButtons = screen.getAllByText("Add expense");
    const button = addButtons.find((el) => el.closest("button")) ?? addButtons[addButtons.length - 1]!;
    const buttonEl = button.closest("button");

    expect(buttonEl?.disabled ?? button.hasAttribute("disabled")).toBe(true);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("shows recurring expense toggle", () => {
    renderWithProviders();
    expect(screen.getByText("Recurring expense")).toBeTruthy();
  });

  it("shows Cancel button", () => {
    renderWithProviders();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("renders participant list for all members", () => {
    renderWithProviders();
    expect(screen.getByText("Split between")).toBeTruthy();
    // Both members are listed (Check icon is mocked to null)
    expect(screen.getAllByText(/Alice W/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bob S/).length).toBeGreaterThan(0);
  });
});
