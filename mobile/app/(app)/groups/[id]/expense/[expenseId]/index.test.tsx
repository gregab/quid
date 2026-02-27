import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTestQueryClient,
  makeExpense,
  makeGroupDetail,
} from "../../../../../../lib/test-utils";

import ExpenseDetailScreen from "./index";

vi.mock("../../../../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1", email: "alice@example.com" },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockDeleteAsync = vi.fn();
const mockStopRecurringAsync = vi.fn();
const mockUseGroupDetail = vi.fn();
const mockUseGroupExpenses = vi.fn();

vi.mock("../../../../../../lib/queries", () => ({
  useGroupDetail: () => mockUseGroupDetail(),
  useGroupExpenses: () => mockUseGroupExpenses(),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
  it("renders expense name and amount", () => {
    renderWithProviders();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("$60.00")).toBeTruthy();
  });

  it("renders formatted date", () => {
    renderWithProviders();
    // Date is formatted as "February 20, 2026"
    expect(screen.getAllByText(/February 20, 2026/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows PAID BY section with payer and amount", () => {
    renderWithProviders();
    expect(screen.getByText("Paid by")).toBeTruthy();
    // payer row shows name
    expect(screen.getByText(/Alice W\./)).toBeTruthy();
  });

  it("shows SPLIT section with member amounts", () => {
    renderWithProviders();
    expect(screen.getByText(/^Split/)).toBeTruthy();
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

  it("does not show Save button (no inline edit mode)", () => {
    renderWithProviders();
    expect(screen.queryByText("Save")).toBeNull();
  });

  it("shows recurring badge when expense has recurringExpense", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, recurringExpense: { id: "rec-1", frequency: "monthly" } })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getAllByText("monthly").length).toBeGreaterThanOrEqual(1);
  });

  it("shows custom annotation in split label when splitType is custom", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, splitType: "custom", splits: [{ userId: "user-1", amountCents: 4000 }, { userId: "user-2", amountCents: 2000 }] })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("Split · custom")).toBeTruthy();
  });

  it("shows payment label for payment expenses", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, isPayment: true, description: "Payment" })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getAllByText("Payment").length).toBeGreaterThanOrEqual(1);
  });

  it("shows amber paid badge in split breakdown", () => {
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
    renderWithProviders();
    expect(screen.queryByText("Stop recurring")).toBeNull();
  });

  it("shows delete button when canDelete is true", () => {
    renderWithProviders();
    expect(screen.getByText("Delete expense")).toBeTruthy();
  });

  it("does not show delete button when canDelete is false", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, canDelete: false })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.queryByText("Delete expense")).toBeNull();
  });

  it("shows edit button when canEdit is true", () => {
    renderWithProviders();
    expect(screen.getByText("Edit")).toBeTruthy();
  });

  it("does not show edit button when canEdit is false", () => {
    mockUseGroupExpenses.mockReturnValue({
      data: [makeExpense({ ...testExpense, canEdit: false })],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.queryByText("Edit")).toBeNull();
  });

  it("close button calls router.back()", () => {
    const mockBack = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ back: mockBack } as unknown as ReturnType<typeof useRouter>);
    renderWithProviders();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(mockBack).toHaveBeenCalled();
  });
});
