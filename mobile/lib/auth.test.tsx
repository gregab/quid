import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth";
import { supabase } from "./supabase";

afterEach(cleanup);

// Component that exposes auth context for testing
function AuthConsumer() {
  const { user, session, loading, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? "none"}</span>
      <span data-testid="session">{session ? "active" : "none"}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in loading state then resolves on INITIAL_SESSION", async () => {
    let authStateCallback: (event: string, session: unknown) => void;

    const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback as (event: string, session: unknown) => void;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as never;
    });

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });

    // Before INITIAL_SESSION fires, should be loading
    expect(screen.getByTestId("loading").textContent).toBe("true");

    // Fire INITIAL_SESSION with no session
    await act(async () => {
      authStateCallback!("INITIAL_SESSION", null);
    });

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("session").textContent).toBe("none");
  });

  it("provides user when session exists via INITIAL_SESSION", async () => {
    const mockSession = {
      user: { id: "user-1", email: "test@example.com" },
      access_token: "token",
    };

    let authStateCallback: (event: string, session: unknown) => void;

    const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback as (event: string, session: unknown) => void;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as never;
    });

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });

    await act(async () => {
      authStateCallback!("INITIAL_SESSION", mockSession);
    });

    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    expect(screen.getByTestId("session").textContent).toBe("active");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("calls supabase.auth.signOut and clears session", async () => {
    const mockSession = {
      user: { id: "user-1", email: "test@example.com" },
      access_token: "token",
    };

    let authStateCallback: (event: string, session: unknown) => void;

    const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback as (event: string, session: unknown) => void;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as never;
    });

    const mockSignOut = vi.mocked(supabase.auth.signOut);
    mockSignOut.mockResolvedValueOnce({ error: null } as never);

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });

    // Provide initial session
    await act(async () => {
      authStateCallback!("INITIAL_SESSION", mockSession);
    });

    expect(screen.getByTestId("session").textContent).toBe("active");

    // Sign out
    await act(async () => {
      fireEvent.click(screen.getByText("Sign Out"));
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(screen.getByTestId("session").textContent).toBe("none");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("updates session when auth state changes after init", async () => {
    let authStateCallback: (event: string, session: unknown) => void;

    const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback as (event: string, session: unknown) => void;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as never;
    });

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });

    // Initial session with no user
    await act(async () => {
      authStateCallback!("INITIAL_SESSION", null);
    });

    expect(screen.getByTestId("session").textContent).toBe("none");

    // Simulate auth state change (user logs in)
    const newSession = {
      user: { id: "user-2", email: "new@example.com" },
      access_token: "new-token",
    };

    await act(async () => {
      authStateCallback!("SIGNED_IN", newSession);
    });

    expect(screen.getByTestId("session").textContent).toBe("active");
    expect(screen.getByTestId("user").textContent).toBe("new@example.com");
  });

  it("unsubscribes from auth state changes on unmount", async () => {
    const unsubscribe = vi.fn();
    const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    } as never);

    let unmount: () => void;
    await act(async () => {
      const result = render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
      unmount = result.unmount;
    });

    unmount!();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it("stops loading after timeout if INITIAL_SESSION never fires", async () => {
    const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as never);

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    });

    // Still loading before timeout
    expect(screen.getByTestId("loading").textContent).toBe("true");

    // Advance past the safety timeout
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});
