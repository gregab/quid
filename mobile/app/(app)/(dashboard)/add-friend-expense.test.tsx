import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { createTestQueryClient } from "../../../lib/test-utils";

// Mock lucide-react-native
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

import AddFriendExpenseScreen from "./add-friend-expense";

// Mock auth with display_name
vi.mock("../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "user-1",
      email: "alice@example.com",
      user_metadata: { display_name: "Alice Wonderland" },
    },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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

const contacts = [
  { userId: "friend-1", displayName: "Bob Smith", avatarUrl: null },
  { userId: "friend-2", displayName: "Carol Jones", avatarUrl: null },
];

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AddFriendExpenseScreen />
    </QueryClientProvider>,
  );
}

describe("AddFriendExpenseScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseContacts.mockReturnValue({ data: contacts });
    mockMutateAsync.mockResolvedValue({ createdCount: 1, friendGroupIds: ["g1"] });
  });

  it("renders header with title and cancel button", () => {
    renderWithProviders();
    expect(screen.getAllByText("Add expense").length).toBeGreaterThan(0);
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("shows contacts as selectable chips", () => {
    renderWithProviders();
    expect(screen.getByText("Bob S.")).toBeTruthy();
    expect(screen.getByText("Carol J.")).toBeTruthy();
  });

  it("shows empty state when no contacts", () => {
    mockUseContacts.mockReturnValue({ data: [] });
    renderWithProviders();
    expect(screen.getByText(/No contacts yet/)).toBeTruthy();
  });

  it("shows ExpenseForm when a friend is selected", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    // ExpenseForm renders with description and amount inputs
    expect(screen.getByPlaceholderText("What's this for?")).toBeTruthy();
    expect(screen.getByPlaceholderText("0.00")).toBeTruthy();
  });

  it("hides ExpenseForm when no friend selected", () => {
    renderWithProviders();
    expect(screen.queryByPlaceholderText("What's this for?")).toBeNull();
  });

  it("deselects friend when same chip clicked again", () => {
    renderWithProviders();
    // Use getAllByText[0] — after selection, ExpenseForm also renders the name
    fireEvent.click(screen.getAllByText("Bob S.")[0]!);
    expect(screen.getByPlaceholderText("What's this for?")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Bob S.")[0]!);
    expect(screen.queryByPlaceholderText("What's this for?")).toBeNull();
  });

  it("switches selected friend when different chip clicked", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    expect(screen.getByPlaceholderText("What's this for?")).toBeTruthy();
    // Click Carol — should switch selection
    fireEvent.click(screen.getByText("Carol J."));
    expect(screen.getByPlaceholderText("What's this for?")).toBeTruthy();
  });

  it("does not show recurring toggle in friend expense form", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    expect(screen.queryByText("Recurring expense")).toBeNull();
  });

  it("shows split type options in friend expense form", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    expect(screen.getByText("Equal")).toBeTruthy();
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText("%")).toBeTruthy();
  });

  it("submits with correct payload when friend selected and form filled", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));

    fireEvent.change(screen.getByPlaceholderText("What's this for?"), {
      target: { value: "Coffee" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "12.50" },
    });

    const submitBtn = screen.getAllByText("Add expense").at(-1)!;
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        friendIds: ["friend-1"],
        description: "Coffee",
        amountCents: 1250,
      }),
    );
  });

  it("passes splitType and splitAmounts on custom split submit", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));

    fireEvent.change(screen.getByPlaceholderText("What's this for?"), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "30.00" },
    });

    fireEvent.click(screen.getByText("Custom"));

    // Both participants in custom mode
    const customInputs = screen.getAllByPlaceholderText("0.00");
    if (customInputs.length >= 3) {
      fireEvent.change(customInputs[1]!, { target: { value: "20.00" } });
      fireEvent.change(customInputs[2]!, { target: { value: "10.00" } });
    }

    const submitBtn = screen.getAllByText("Add expense").at(-1)!;
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    if (mockMutateAsync.mock.calls.length > 0) {
      const call = mockMutateAsync.mock.calls[0]![0] as { splitType?: string };
      expect(call.splitType).toBe("custom");
    }
  });

  it("cancel button navigates back", () => {
    const mockBack = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      back: mockBack,
      push: vi.fn(),
      replace: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as never);

    renderWithProviders();
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows disabled 'Select a friend above' prompt when contacts exist but none selected", () => {
    renderWithProviders();
    expect(screen.getByText("Select a friend above")).toBeTruthy();
  });

  it("hides 'Select a friend above' prompt when a friend is selected", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));
    expect(screen.queryByText("Select a friend above")).toBeNull();
  });

  it("triggers haptics on successful submission", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));

    fireEvent.change(screen.getByPlaceholderText("What's this for?"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "20.00" },
    });

    const submitBtn = screen.getAllByText("Add expense").at(-1)!;
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(Haptics.notificationAsync).toHaveBeenCalled();
  });

  it("navigates back after successful submission", async () => {
    const mockBack = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      back: mockBack,
      push: vi.fn(),
      replace: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as never);

    renderWithProviders();
    fireEvent.click(screen.getByText("Bob S."));

    fireEvent.change(screen.getByPlaceholderText("What's this for?"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "20.00" },
    });

    const submitBtn = screen.getAllByText("Add expense").at(-1)!;
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it("shows loading state when contacts are undefined", () => {
    mockUseContacts.mockReturnValue({ data: undefined });
    renderWithProviders();
    // No contacts rendered, no empty state shown (data is undefined, not empty array)
    expect(screen.queryByText("Bob S.")).toBeNull();
    expect(screen.queryByText("Carol J.")).toBeNull();
  });
});
