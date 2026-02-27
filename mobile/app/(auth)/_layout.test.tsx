import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useLocalSearchParams } from "expo-router";
import AuthLayout from "./_layout";

// Mock auth with controllable return value
const mockUseAuth = vi.fn();
vi.mock("../../lib/auth", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

// Override expo-router for this test
vi.mock("expo-router", () => {
  const React = require("react");
  return {
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
    Redirect: ({ href }: { href: string }) =>
      React.createElement("div", { "data-testid": "redirect", "data-href": href }),
  };
});

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
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" }, access_token: "token" },
      loading: false,
    });

    render(<AuthLayout />);

    const redirect = screen.getByTestId("redirect");
    expect(redirect.getAttribute("data-href")).toBe("/(app)/(dashboard)");
  });

  it("renders Stack when not authenticated", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false });

    render(<AuthLayout />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByTestId("redirect")).toBeNull();
  });

  it("redirects to next param when authenticated with next", () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({ next: "/invite/invite-abc" });

    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" }, access_token: "token" },
      loading: false,
    });

    render(<AuthLayout />);

    const redirect = screen.getByTestId("redirect");
    expect(redirect.getAttribute("data-href")).toBe("/invite/invite-abc");
  });

  it("redirects to dashboard when authenticated without next param", () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({});

    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" }, access_token: "token" },
      loading: false,
    });

    render(<AuthLayout />);

    const redirect = screen.getByTestId("redirect");
    expect(redirect.getAttribute("data-href")).toBe("/(app)/(dashboard)");
  });
});
