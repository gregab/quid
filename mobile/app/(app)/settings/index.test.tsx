import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Alert } from "react-native";
import { createTestQueryClient, makeGroup } from "../../../lib/test-utils";

// Mock lucide-react-native to prevent hanging in happy-dom
vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
  LogOut: () => null,
  Moon: () => null,
  Pencil: () => null,
  Shield: () => null,
  FileText: () => null,
  Trash2: () => null,
  AlertTriangle: () => null,
}));

// Mock colorScheme provider
vi.mock("../../../lib/colorScheme", () => ({
  useColorSchemePreference: vi.fn(() => ({
    preference: "system",
    colorScheme: "light",
    cyclePreference: vi.fn(),
  })),
}));

import SettingsScreen from "./index";

const mockSignOut = vi.fn();

// Mock auth
vi.mock("../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1", email: "alice@example.com" },
    session: { access_token: "tok" },
    loading: false,
    signOut: mockSignOut,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseCurrentUser = vi.fn();
const mockUseGroups = vi.fn();
const mockUpdateAsync = vi.fn();
const mockDeleteAsync = vi.fn();

vi.mock("../../../lib/queries", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
  useGroups: () => mockUseGroups(),
  useUpdateProfile: () => ({
    mutateAsync: mockUpdateAsync,
    isPending: false,
  }),
  useDeleteAccount: () => ({
    mutateAsync: mockDeleteAsync,
    isPending: false,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCurrentUser.mockReturnValue({
    data: { displayName: "Alice Wonderland", email: "alice@example.com" },
    isLoading: false,
  });
  mockUseGroups.mockReturnValue({
    data: [],
  });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
}

describe("SettingsScreen", () => {
  it("renders settings title", () => {
    renderWithProviders();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders back button and navigates back on press", () => {
    const back = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      back,
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);

    renderWithProviders();
    const backButton = screen.getByText("Back").closest("button")!;
    fireEvent.click(backButton);
    expect(back).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    mockUseCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderWithProviders();
    expect(screen.getByText("Loading settings...")).toBeTruthy();
  });

  it("displays user email", () => {
    renderWithProviders();
    expect(screen.getByText("alice@example.com")).toBeTruthy();
  });

  it("displays display name in profile header and settings row", () => {
    renderWithProviders();
    // Appears in profile header and in the SettingsRow value
    expect(screen.getAllByText("Alice Wonderland").length).toBe(2);
  });

  it("renders tappable display name row", () => {
    renderWithProviders();
    expect(screen.getByText("Display name")).toBeTruthy();
  });

  it("shows edit form when display name row is pressed", () => {
    renderWithProviders();
    const row = screen.getByText("Display name").closest("button")!;
    fireEvent.click(row);
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("saves updated display name", async () => {
    mockUpdateAsync.mockResolvedValueOnce(undefined);
    renderWithProviders();

    const row = screen.getByText("Display name").closest("button")!;
    fireEvent.click(row);

    // The input should be pre-filled with current name
    const input = screen.getByDisplayValue("Alice Wonderland");
    fireEvent.change(input, { target: { value: "Alice W" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(mockUpdateAsync).toHaveBeenCalledWith({ displayName: "Alice W" });
  });

  it("shows validation error for empty display name", async () => {
    renderWithProviders();

    const row = screen.getByText("Display name").closest("button")!;
    fireEvent.click(row);

    const input = screen.getByDisplayValue("Alice Wonderland");
    fireEvent.change(input, { target: { value: "   " } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(screen.getByText("Display name is required.")).toBeTruthy();
    expect(mockUpdateAsync).not.toHaveBeenCalled();
  });

  it("shows dark mode status", () => {
    renderWithProviders();
    expect(screen.getByText("Dark mode")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
  });

  it("renders Sign out button", () => {
    renderWithProviders();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("calls signOut when Sign out is pressed", () => {
    renderWithProviders();
    const signOutText = screen.getByText("Sign out");
    const button = signOutText.closest("button")!;
    fireEvent.click(button);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("renders Delete account button", () => {
    renderWithProviders();
    expect(screen.getByText("Delete my account")).toBeTruthy();
  });

  it("renders Privacy Policy link that opens in browser", () => {
    renderWithProviders();
    const privacyText = screen.getByText("Privacy Policy");
    expect(privacyText).toBeTruthy();
    // The Pressable renders as a <button> wrapping the Card/Text
    const button = privacyText.closest("button")!;
    fireEvent.click(button);
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://aviary.gregbigelow.com/privacy",
    );
  });

  it("renders Terms of Service link that opens in browser", () => {
    renderWithProviders();
    const tosText = screen.getByText("Terms of Service");
    expect(tosText).toBeTruthy();
    const button = tosText.closest("button")!;
    fireEvent.click(button);
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://aviary.gregbigelow.com/terms",
    );
  });

  it("triggers delete account through Alert confirmation", async () => {
    mockDeleteAsync.mockResolvedValueOnce(undefined);
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);

    renderWithProviders();

    await act(async () => {
      fireEvent.click(screen.getByText("Delete my account"));
    });

    // Alert mock auto-confirms last button for both double-confirmation dialogs
    expect(mockDeleteAsync).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("cancels edit mode without saving", () => {
    renderWithProviders();

    const row = screen.getByText("Display name").closest("button")!;
    fireEvent.click(row);
    expect(screen.getByText("Save")).toBeTruthy();

    fireEvent.click(screen.getByText("Cancel"));
    // Should be back to display mode
    expect(screen.queryByText("Save")).toBeNull();
    expect(screen.getAllByText("Alice Wonderland").length).toBe(2);
    expect(mockUpdateAsync).not.toHaveBeenCalled();
  });

  it("shows validation error for name exceeding max length", async () => {
    renderWithProviders();

    const row = screen.getByText("Display name").closest("button")!;
    fireEvent.click(row);
    const input = screen.getByDisplayValue("Alice Wonderland");
    fireEvent.change(input, { target: { value: "A".repeat(100) } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(screen.getByText(/characters or less/)).toBeTruthy();
    expect(mockUpdateAsync).not.toHaveBeenCalled();
  });

  it("blocks account deletion when user has outstanding balances", async () => {
    const alertSpy = vi.spyOn(Alert, "alert");
    mockUseGroups.mockReturnValue({
      data: [
        makeGroup({ id: "g1", name: "Trip", balanceCents: 5000 }),
        makeGroup({ id: "g2", name: "Rent", balanceCents: 0 }),
      ],
    });

    renderWithProviders();

    await act(async () => {
      fireEvent.click(screen.getByText("Delete my account"));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Can't delete account",
      expect.stringContaining("1 group"),
      expect.any(Array),
    );
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it("shows outstanding balances warning banner when user has debts", () => {
    mockUseGroups.mockReturnValue({
      data: [
        makeGroup({ id: "g1", name: "Trip", balanceCents: 5000 }),
        makeGroup({ id: "g2", name: "Rent", balanceCents: 0 }),
      ],
    });

    renderWithProviders();
    expect(screen.getByText("Outstanding balances")).toBeTruthy();
  });

  it("does not show outstanding balances warning when all balances are zero", () => {
    mockUseGroups.mockReturnValue({
      data: [makeGroup({ id: "g1", name: "Rent", balanceCents: 0 })],
    });

    renderWithProviders();
    expect(screen.queryByText("Outstanding balances")).toBeNull();
  });

  it("shows profile avatar emoji", () => {
    mockUseCurrentUser.mockReturnValue({
      data: { displayName: "Alice", email: "alice@example.com", defaultEmoji: "🦅" },
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("🦅")).toBeTruthy();
  });

  it("falls back to default emoji when none is set", () => {
    mockUseCurrentUser.mockReturnValue({
      data: { displayName: "Alice", email: "alice@example.com" },
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("🐦")).toBeTruthy();
  });

  it("shows error when update profile fails", async () => {
    mockUpdateAsync.mockRejectedValueOnce(new Error("Network error"));
    renderWithProviders();

    const row = screen.getByText("Display name").closest("button")!;
    fireEvent.click(row);

    const input = screen.getByDisplayValue("Alice Wonderland");
    fireEvent.change(input, { target: { value: "New Name" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(screen.getByText("Network error")).toBeTruthy();
  });

  it("shows dash when display name is null", () => {
    mockUseCurrentUser.mockReturnValue({
      data: { displayName: null, email: "alice@example.com" },
      isLoading: false,
    });
    renderWithProviders();
    // "—" em-dash shown as fallback
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
