import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import AuthCallbackScreen from "./callback";

afterEach(cleanup);

const mockReplace = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    canGoBack: vi.fn(() => true),
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AuthCallbackScreen", () => {
  it("shows loading spinner while processing", () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({ code: "test-code" });
    vi.mocked(supabase.auth.exchangeCodeForSession).mockReturnValue(
      new Promise(() => {}) as never, // never resolves — stays in loading state
    );
    render(<AuthCallbackScreen />);
    expect(screen.getByText("Verifying...")).toBeTruthy();
  });

  it("exchanges code and redirects to dashboard on success", async () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({ code: "valid-code" });
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { session: { access_token: "tok", refresh_token: "ref" } },
      error: null,
    } as never);

    await act(async () => {
      render(<AuthCallbackScreen />);
    });

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      "valid-code",
    );
    expect(mockReplace).toHaveBeenCalledWith("/(app)/(dashboard)");
  });

  it("shows error and redirects to login when code exchange fails", async () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({ code: "bad-code" });
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { session: null },
      error: { message: "Code expired" },
    } as never);

    await act(async () => {
      render(<AuthCallbackScreen />);
    });

    expect(screen.getByText("Unable to verify")).toBeTruthy();
    expect(screen.getByText("Code expired")).toBeTruthy();

    // Advance timer to trigger redirect
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("shows error when no code is present", async () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({});

    await act(async () => {
      render(<AuthCallbackScreen />);
    });

    expect(screen.getByText("Unable to verify")).toBeTruthy();
    expect(
      screen.getByText(
        "No confirmation code found. The link may have expired.",
      ),
    ).toBeTruthy();
  });
});
