import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import LoginScreen from "./login";

// Mock the auth context
vi.mock("../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("••••••••")).toBeTruthy();
  });

  it("renders the Aviary branding", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Aviary")).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });

  it("renders Log In button", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Log In")).toBeTruthy();
  });

  it("renders sign up link", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Sign up")).toBeTruthy();
  });

  it("shows error when submitting empty fields", async () => {
    render(<LoginScreen />);

    await act(async () => {
      fireEvent.click(screen.getByText("Log In"));
    });

    expect(
      screen.getByText("Please enter your email and password."),
    ).toBeTruthy();
  });

  it("calls signInWithPassword on valid submit", async () => {
    const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    } as never);

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Log In"));
    });

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("shows auth error from Supabase", async () => {
    const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    } as never);

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "badpassword" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Log In"));
    });

    expect(screen.getByText("Incorrect email or password. Please try again.")).toBeTruthy();
  });

  it("redirects to next param after successful login", async () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useLocalSearchParams).mockReturnValue({ next: "/invite/invite-abc" });

    const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    } as never);

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Log In"));
    });

    expect(replace).toHaveBeenCalledWith("/invite/invite-abc");
  });

  it("does not redirect after successful login when no next param", async () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useLocalSearchParams).mockReturnValue({});

    const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    } as never);

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Log In"));
    });

    // Login screen does not redirect — the auth layout handles dashboard redirect
    expect(replace).not.toHaveBeenCalled();
  });
});
