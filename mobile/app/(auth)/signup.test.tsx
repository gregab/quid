import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { supabase } from "../../lib/supabase";
import SignupScreen from "./signup";

afterEach(cleanup);

describe("SignupScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders display name, email, and password fields", () => {
    render(<SignupScreen />);
    expect(screen.getByPlaceholderText("Your name")).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("At least 6 characters")).toBeTruthy();
  });

  it("renders the Aviary branding", () => {
    render(<SignupScreen />);
    expect(screen.getByText("Aviary")).toBeTruthy();
    expect(screen.getByText("Create your account")).toBeTruthy();
  });

  it("renders Sign Up button", () => {
    render(<SignupScreen />);
    expect(screen.getByText("Sign Up")).toBeTruthy();
  });

  it("renders login link", () => {
    render(<SignupScreen />);
    expect(screen.getByText("Log in")).toBeTruthy();
    expect(screen.getByText("Already have an account?")).toBeTruthy();
  });

  it("shows error when display name is empty", async () => {
    render(<SignupScreen />);

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Up"));
    });

    expect(screen.getByText("Please enter your name.")).toBeTruthy();
  });

  it("shows error when email is empty", async () => {
    render(<SignupScreen />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Up"));
    });

    expect(screen.getByText("Please enter your email.")).toBeTruthy();
  });

  it("shows error when password is too short", async () => {
    render(<SignupScreen />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), {
      target: { value: "short" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Up"));
    });

    expect(
      screen.getByText("Password must be at least 6 characters."),
    ).toBeTruthy();
  });

  it("calls signUp with correct parameters on valid submit", async () => {
    const mockSignUp = vi.mocked(supabase.auth.signUp);
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    } as never);

    render(<SignupScreen />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Up"));
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
      options: {
        data: { displayName: "Test User" },
      },
    });
  });

  it("shows email confirmation screen on successful signup", async () => {
    const mockSignUp = vi.mocked(supabase.auth.signUp);
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    } as never);

    render(<SignupScreen />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Up"));
    });

    expect(screen.getByText("Check your email")).toBeTruthy();
    expect(
      screen.getByText(/We sent a confirmation link to test@example.com/),
    ).toBeTruthy();
    expect(screen.getByText("Back to login")).toBeTruthy();
  });

  it("shows auth error from Supabase", async () => {
    const mockSignUp = vi.mocked(supabase.auth.signUp);
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    } as never);

    render(<SignupScreen />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Up"));
    });

    expect(screen.getByText("An account with this email already exists. Try logging in instead.")).toBeTruthy();
  });

  it("renders Continue with Google button", () => {
    render(<SignupScreen />);
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("trims whitespace from display name and email", async () => {
    const mockSignUp = vi.mocked(supabase.auth.signUp);
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    } as never);

    render(<SignupScreen />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "  Test User  " },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "  test@example.com  " },
    });
    fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Sign Up"));
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
      options: {
        data: { displayName: "Test User" },
      },
    });
  });
});
