import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { createTestQueryClient, makeGroup } from "../../../lib/test-utils";
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

  it("displays display name", () => {
    renderWithProviders();
    expect(screen.getByText("Alice Wonderland")).toBeTruthy();
  });

  it("renders Edit button for display name", () => {
    renderWithProviders();
    expect(screen.getByText("Edit")).toBeTruthy();
  });

  it("shows edit form when Edit is pressed", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("saves updated display name", async () => {
    mockUpdateAsync.mockResolvedValueOnce(undefined);
    renderWithProviders();

    fireEvent.click(screen.getByText("Edit"));

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

    fireEvent.click(screen.getByText("Edit"));

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
    expect(screen.getByText("Off (follows system)")).toBeTruthy();
  });

  it("renders Log out button", () => {
    renderWithProviders();
    expect(screen.getByText("Log out")).toBeTruthy();
  });

  it("calls signOut when Log out is pressed", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("Log out"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("renders Delete account button", () => {
    renderWithProviders();
    expect(screen.getByText("Delete account")).toBeTruthy();
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
      fireEvent.click(screen.getByText("Delete account"));
    });

    // Alert mock auto-confirms last button for both double-confirmation dialogs
    expect(mockDeleteAsync).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/(auth)/login");
  });
});
