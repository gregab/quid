import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTestQueryClient,
  makeExpense,
  makeGroupDetail,
} from "../../../../../lib/test-utils";

import ExpenseDetailScreen from "./[expenseId]";

vi.mock("../../../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1", email: "alice@example.com" },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUpdateAsync = vi.fn();
const mockDeleteAsync = vi.fn();
const mockStopRecurringAsync = vi.fn();
const mockUseGroupDetail = vi.fn();
const mockUseGroupExpenses = vi.fn();

vi.mock("../../../../../lib/queries", () => ({
  useGroupDetail: () => mockUseGroupDetail(),
  useGroupExpenses: () => mockUseGroupExpenses(),
  useUpdateExpense: () => ({ mutateAsync: mockUpdateAsync, isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: mockDeleteAsync, isPending: false }),
  useStopRecurringExpense: () => ({ mutateAsync: mockStopRecurringAsync, isPending: false }),
}));

afterEach(cleanup);

const testExpense = makeExpense({
  id: "exp-1",
  description: "Dinner",
  amountCents: 6000,
  date: "2026-02-20",
  paidById: "user-1",
  paidByDisplayName: "Alice Wonderland",
  participantIds: ["user-1", "user-2"],
  splits: [
    { userId: "user-1", amountCents: 3000 },
    { userId: "user-2", amountCents: 3000 },
  ],
  canEdit: true,
  canDelete: true,
  createdById: "user-1",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLocalSearchParams).mockReturnValue({ id: "group-1", expenseId: "exp-1" });
  mockUseGroupDetail.mockReturnValue({ data: makeGroupDetail(), isLoading: false });
  mockUseGroupExpenses.mockReturnValue({ data: [testExpense], isLoading: false });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ExpenseDetailScreen />
    </QueryClientProvider>,
  );
}

describe("ExpenseDetailScreen", () => {
  it("renders expense details in view mode", () => {
    renderWithProviders();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("$60.00")).toBeTruthy();
    expect(screen.getByText("2026-02-20")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("shows split breakdown", () => {
    renderWithProviders();
    expect(screen.getByText("Split breakdown")).toBeTruthy();
    expect(screen.getAllByText("$30.00").length).toBe(2);
  });

  it("shows 'Expense not found' when expense doesn't exist", () => {
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders();
    expect(screen.getByText("Expense not found")).toBeTruthy();
  });

  it("shows loading state", () => {
    mockUseGroupExpenses.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders();
    expect(screen.queryByText("Dinner")).toBeNull();
  });

  it("does not show edit form initially", () => {
    renderWithProviders();
    expect(screen.queryByText("Save")).toBeNull();
  });

  it("shows recurring badge when expense has recurringExpense", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, recurringExpense: { id: "rec-1", frequency: "monthly" } })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("monthly")).toBeTruthy();
  });

  it("shows custom split type when applicable", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, splitType: "custom", splits: [{ userId: "user-1", amountCents: 4000 }, { userId: "user-2", amountCents: 2000 }] })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("custom")).toBeTruthy();
  });

  it("shows payment label for payment expenses", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, isPayment: true, description: "Payment" })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getAllByText("Payment").length).toBeGreaterThanOrEqual(1);
  });

  it("shows payer badge in split breakdown", () => {
    renderWithProviders();
    expect(screen.getByText("paid")).toBeTruthy();
  });

  it("shows stop recurring button for recurring expenses", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, recurringExpense: { id: "rec-1", frequency: "monthly" } })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("Stop recurring")).toBeTruthy();
  });

  it("does not show stop recurring button for non-recurring expenses", () => {
    renderWithProviders(); // testExpense has no recurringExpense
    expect(screen.queryByText("Stop recurring")).toBeNull();
  });
});
