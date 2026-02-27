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
import * as Haptics from "expo-haptics";
import { createTestQueryClient } from "../../../../lib/test-utils";
import { Alert } from "react-native";

// Must mock lucide at test level to prevent loading react-native-svg
vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  Square: () => null,
  Plus: () => null,
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

import RecurringExpensesScreen from "./recurring";
import type { RecurringExpenseRow } from "../../../../lib/queries/recurring";

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

const mockMutateFn = vi.fn();
const mockUseRecurringExpenses = vi.fn();
const mockUseStopRecurringExpense = vi.fn();

vi.mock("../../../../lib/queries", () => ({
  useRecurringExpenses: (...args: unknown[]) =>
    mockUseRecurringExpenses(...args),
  useStopRecurringExpense: (...args: unknown[]) =>
    mockUseStopRecurringExpense(...args),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLocalSearchParams).mockReturnValue({ id: "group-1" });
  mockUseStopRecurringExpense.mockReturnValue({
    mutate: mockMutateFn,
    isPending: false,
    variables: undefined,
  });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <RecurringExpensesScreen />
    </QueryClientProvider>,
  );
}

describe("RecurringExpensesScreen", () => {
  it("shows loading state", () => {
    mockUseRecurringExpenses.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderWithProviders();
    expect(screen.getByText("Loading recurring expenses...")).toBeTruthy();
  });

  it("shows empty state when no recurring expenses", () => {
    mockUseRecurringExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderWithProviders();
    expect(screen.getByText("No recurring expenses")).toBeTruthy();
  });

  it("renders recurring expense items", () => {
    const items: RecurringExpenseRow[] = [
      {
        id: "rec-1",
        description: "Weekly groceries",
        amountCents: 5000,
        frequency: "weekly",
        nextDueDate: "2026-03-01",
        paidByDisplayName: "Alice",
        isActive: true,
      },
      {
        id: "rec-2",
        description: "Monthly rent",
        amountCents: 100000,
        frequency: "monthly",
        nextDueDate: "2026-04-01",
        paidByDisplayName: "Bob",
        isActive: true,
      },
    ];

    mockUseRecurringExpenses.mockReturnValue({
      data: items,
      isLoading: false,
    });

    renderWithProviders();

    expect(screen.getByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByText("$50.00")).toBeTruthy();
    expect(screen.getAllByText("Weekly").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Paid by Alice")).toBeTruthy();
    expect(screen.getByText("Next due 2026-03-01")).toBeTruthy();

    expect(screen.getByText("Monthly rent")).toBeTruthy();
    expect(screen.getByText("$1000.00")).toBeTruthy();
    expect(screen.getAllByText("Monthly").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Paid by Bob")).toBeTruthy();

    // Two stop buttons
    expect(screen.getAllByText("Stop")).toHaveLength(2);
  });

  it("shows confirmation alert when stop is pressed", () => {
    const alertSpy = vi.spyOn(Alert, "alert");

    mockUseRecurringExpenses.mockReturnValue({
      data: [
        {
          id: "rec-1",
          description: "Weekly groceries",
          amountCents: 5000,
          frequency: "weekly",
          nextDueDate: "2026-03-01",
          paidByDisplayName: "Alice",
          isActive: true,
        },
      ],
      isLoading: false,
    });

    renderWithProviders();

    fireEvent.click(screen.getByText("Stop"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Stop Recurring Expense",
      expect.stringContaining("Weekly groceries"),
      expect.arrayContaining([
        expect.objectContaining({ text: "Cancel" }),
        expect.objectContaining({ text: "Stop", style: "destructive" }),
      ]),
    );
  });

  it("calls stop mutation when alert is confirmed", () => {
    const alertSpy = vi.spyOn(Alert, "alert");

    mockUseRecurringExpenses.mockReturnValue({
      data: [
        {
          id: "rec-1",
          description: "Weekly groceries",
          amountCents: 5000,
          frequency: "weekly",
          nextDueDate: "2026-03-01",
          paidByDisplayName: "Alice",
          isActive: true,
        },
      ],
      isLoading: false,
    });

    renderWithProviders();

    fireEvent.click(screen.getByText("Stop"));

    // Simulate pressing "Stop" in the alert
    const alertCall = alertSpy.mock.calls[0];
    const buttons = alertCall![2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const stopButton = buttons.find((b) => b.text === "Stop");

    act(() => {
      stopButton!.onPress!();
    });

    expect(mockMutateFn).toHaveBeenCalledWith("rec-1");
  });

  it("navigates back when back button is pressed", () => {
    const mockRouter = { back: vi.fn(), push: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof useRouter>,
    );

    mockUseRecurringExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderWithProviders();

    fireEvent.click(screen.getByText("Back"));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("shows 'Stopping...' when mutation is pending for that item", () => {
    mockUseStopRecurringExpense.mockReturnValue({
      mutate: mockMutateFn,
      isPending: true,
      variables: "rec-1",
    });

    mockUseRecurringExpenses.mockReturnValue({
      data: [
        {
          id: "rec-1",
          description: "Weekly groceries",
          amountCents: 5000,
          frequency: "weekly",
          nextDueDate: "2026-03-01",
          paidByDisplayName: "Alice",
          isActive: true,
        },
        {
          id: "rec-2",
          description: "Monthly rent",
          amountCents: 100000,
          frequency: "monthly",
          nextDueDate: "2026-04-01",
          paidByDisplayName: "Bob",
          isActive: true,
        },
      ],
      isLoading: false,
    });

    renderWithProviders();

    // rec-1 should show "Stopping..." while rec-2 still shows "Stop"
    expect(screen.getByText("Stopping...")).toBeTruthy();
    expect(screen.getByText("Stop")).toBeTruthy();
  });

  it("triggers haptics when stop is confirmed", () => {
    const alertSpy = vi.spyOn(Alert, "alert");

    mockUseRecurringExpenses.mockReturnValue({
      data: [
        {
          id: "rec-1",
          description: "Weekly groceries",
          amountCents: 5000,
          frequency: "weekly",
          nextDueDate: "2026-03-01",
          paidByDisplayName: "Alice",
          isActive: true,
        },
      ],
      isLoading: false,
    });

    renderWithProviders();
    fireEvent.click(screen.getByText("Stop"));

    // Simulate pressing "Stop" in the alert
    const alertCall = alertSpy.mock.calls[0];
    const buttons = alertCall![2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const stopButton = buttons.find((b) => b.text === "Stop");

    act(() => {
      stopButton!.onPress!();
    });

    expect(vi.mocked(Haptics.impactAsync)).toHaveBeenCalledWith("medium");
  });

  it("navigates to add-expense when 'Add recurring expense' button is pressed", () => {
    const mockRouter = { back: vi.fn(), push: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof useRouter>,
    );

    mockUseRecurringExpenses.mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderWithProviders();

    fireEvent.click(screen.getByText("Add recurring expense"));
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/(app)/groups/group-1/add-expense",
    );
  });

  it("renders yearly frequency badge correctly", () => {
    mockUseRecurringExpenses.mockReturnValue({
      data: [
        {
          id: "rec-3",
          description: "Annual subscription",
          amountCents: 12000,
          frequency: "yearly",
          nextDueDate: "2027-01-01",
          paidByDisplayName: "Alice",
          isActive: true,
        },
      ],
      isLoading: false,
    });

    renderWithProviders();

    expect(screen.getByText("Annual subscription")).toBeTruthy();
    expect(screen.getByText("$120.00")).toBeTruthy();
    expect(screen.getByText("Yearly")).toBeTruthy();
  });
});
