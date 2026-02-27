import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { supabase } from "../../lib/supabase";
import ForgotPasswordScreen from "./forgot-password";

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

describe("ForgotPasswordScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email input and submit button", () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByText("Send Reset Link")).toBeTruthy();
  });

  it("renders the Aviary branding", () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText("Aviary")).toBeTruthy();
    expect(screen.getByText("Reset your password")).toBeTruthy();
  });

  it("shows error when submitting empty email", async () => {
    render(<ForgotPasswordScreen />);

    await act(async () => {
      fireEvent.click(screen.getByText("Send Reset Link"));
    });

    expect(screen.getByText("Please enter your email.")).toBeTruthy();
  });

  it("shows success state after successful submit", async () => {
    const mockReset = vi.mocked(supabase.auth.resetPasswordForEmail);
    mockReset.mockResolvedValueOnce({
      data: {},
      error: null,
    } as never);

    render(<ForgotPasswordScreen />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Send Reset Link"));
    });

    expect(mockReset).toHaveBeenCalledWith("test@example.com", {
      redirectTo: "aviary://auth/callback",
    });
    expect(screen.getByText("Check your inbox")).toBeTruthy();
    expect(
      screen.getByText(/We sent a password reset link to test@example.com/),
    ).toBeTruthy();
  });

  it("shows friendly error on auth failure", async () => {
    const mockReset = vi.mocked(supabase.auth.resetPasswordForEmail);
    mockReset.mockResolvedValueOnce({
      data: {},
      error: { message: "Email rate limit exceeded" },
    } as never);

    render(<ForgotPasswordScreen />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Send Reset Link"));
    });

    expect(
      screen.getByText("Too many attempts. Please wait a moment and try again."),
    ).toBeTruthy();
  });

  it("renders back to login link", () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText("Back to login")).toBeTruthy();
  });
});
