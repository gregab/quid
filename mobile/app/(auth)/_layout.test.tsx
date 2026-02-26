import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useRouter, useLocalSearchParams } from "expo-router";
import AuthLayout from "./_layout";

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

describe("AuthLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true });

    render(<AuthLayout />);

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("redirects to dashboard when already authenticated", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);

    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" }, access_token: "token" },
      loading: false,
    });

    render(<AuthLayout />);

    expect(replace).toHaveBeenCalledWith("/(app)/(dashboard)");
  });

  it("renders Stack when not authenticated", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false });

    render(<AuthLayout />);

    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("redirects to next param when authenticated with next", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useLocalSearchParams).mockReturnValue({ next: "/invite/invite-abc" });

    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" }, access_token: "token" },
      loading: false,
    });

    render(<AuthLayout />);

    expect(replace).toHaveBeenCalledWith("/invite/invite-abc");
  });

  it("redirects to dashboard when authenticated without next param", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useLocalSearchParams).mockReturnValue({});

    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" }, access_token: "token" },
      loading: false,
    });

    render(<AuthLayout />);

    expect(replace).toHaveBeenCalledWith("/(app)/(dashboard)");
  });
});
