import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useRouter } from "expo-router";
import AppLayout from "./_layout";

// Mock auth with controllable return value
const mockUseAuth = vi.fn();
vi.mock("../../lib/auth", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

// Override expo-router for this test to track router.replace calls
vi.mock("expo-router", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(() => true),
  })),
  useLocalSearchParams: vi.fn(() => ({})),
  useSegments: vi.fn(() => []),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Screen: () => null },
  ),
  Slot: () => null,
}));

afterEach(cleanup);

describe("AppLayout (protected route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true });

    render(<AppLayout />);

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("redirects to login when not authenticated", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);

    mockUseAuth.mockReturnValue({ session: null, loading: false });

    render(<AppLayout />);

    expect(replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("renders Stack when authenticated", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" }, access_token: "token" },
      loading: false,
    });

    render(<AppLayout />);

    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
