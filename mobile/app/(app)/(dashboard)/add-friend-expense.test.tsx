import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../../../lib/test-utils";
import AddFriendExpenseScreen from "./add-friend-expense";

// Mock lucide-react-native
vi.mock("lucide-react-native", () => ({
  Check: () => null,
}));

// Mock auth
vi.mock("../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "user-1",
      email: "alice@example.com",
      user_metadata: { display_name: "Alice" },
    },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock queries
const mockMutateAsync = vi.fn();
const mockUseContacts = vi.fn();

vi.mock("../../../lib/queries", () => ({
  useContacts: () => mockUseContacts(),
  useCreateFriendExpense: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

afterEach(cleanup);

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AddFriendExpenseScreen />
    </QueryClientProvider>,
  );
}

const contacts = [
  { userId: "friend-1", displayName: "Bob Smith", avatarUrl: null },
  { userId: "friend-2", displayName: "Carol Jones", avatarUrl: null },
  { userId: "friend-3", displayName: "Dave Lee", avatarUrl: null },
];

describe("AddFriendExpenseScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseContacts.mockReturnValue({ data: contacts });
    mockMutateAsync.mockResolvedValue({ createdCount: 1, friendGroupIds: ["g1"] });
  });

  it("renders header and cancel button", () => {
    renderWithProviders();
    expect(screen.getByText("Add expense with friends")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("shows contacts as selectable pills", () => {
    renderWithProviders();
    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.getByText("Carol J.")).toBeTruthy();
    expect(screen.getByText("Dave L.")).toBeTruthy();
  });

  it("shows empty state when no contacts", () => {
    mockUseContacts.mockReturnValue({ data: [] });
    renderWithProviders();
    expect(screen.getByText(/No contacts yet/)).toBeTruthy();
  });

  it("toggles friend selection on click", () => {
    renderWithProviders();
    const bobPill = screen.getByText("Bob S.");
    fireEvent.click(bobPill);
    // Split info should appear when a friend is selected
    // (requires amount > 0 too, so let's check payer selector instead)
    expect(screen.getByText("Paid by")).toBeTruthy();
  });

  it("shows payer selector when exactly 1 friend selected", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    expect(screen.getByText("Paid by")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    // Bob S. appears as contact pill AND payer option
    expect(screen.getAllByText("Bob S.").length).toBeGreaterThanOrEqual(2);
  });

  it("hides payer selector when multiple friends selected", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    fireEvent.click(screen.getByText("Carol J."));
    expect(screen.queryByText("Paid by")).toBeNull();
  });

  it("shows split info when friend selected and amount entered", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    const amountInput = screen.getByPlaceholderText("$0.00");
    fireEvent.change(amountInput, { target: { value: "20.00" } });
    expect(screen.getByText(/Split equally between you and 1 friend/)).toBeTruthy();
  });

  it("shows multi-friend split info", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    fireEvent.click(screen.getByText("Carol J."));
    const amountInput = screen.getByPlaceholderText("$0.00");
    fireEvent.change(amountInput, { target: { value: "30.00" } });
    expect(screen.getByText(/Split equally between you and 2 friends/)).toBeTruthy();
  });

  it("submits with correct payload", async () => {
    renderWithProviders();

    // Select a friend
    fireEvent.click(screen.getByText("Bob S."));

    // Fill in description
    const descInput = screen.getByPlaceholderText("Dinner, groceries, etc.");
    fireEvent.change(descInput, { target: { value: "Coffee" } });

    // Fill in amount
    const amountInput = screen.getByPlaceholderText("$0.00");
    fireEvent.change(amountInput, { target: { value: "12.50" } });

    // Submit
    const submitButton = screen.getAllByText("Add expense");
    await act(async () => {
      fireEvent.click(submitButton[submitButton.length - 1]!);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        friendIds: ["friend-1"],
        description: "Coffee",
        amountCents: 1250,
      }),
    );
  });
});
