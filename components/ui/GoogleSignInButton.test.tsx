// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GoogleSignInButton } from "./GoogleSignInButton";

afterEach(cleanup);

const mockSignInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

describe("GoogleSignInButton", () => {
  it("renders the button with correct text", () => {
    render(<GoogleSignInButton />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeTruthy();
  });

  it("renders the Google logo SVG", () => {
    render(<GoogleSignInButton />);
    const button = screen.getByRole("button");
    expect(button.querySelector("svg")).toBeTruthy();
  });

  it("calls signInWithOAuth with google provider on click", async () => {
    render(<GoogleSignInButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining("/auth/callback"),
      },
    });
  });

  it("includes next param in redirectTo when provided", async () => {
    render(<GoogleSignInButton next="/invite/abc123" />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining(
          "/auth/callback?next=%2Finvite%2Fabc123"
        ),
      },
    });
  });

  it("shows loading text after click", async () => {
    render(<GoogleSignInButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toContain("Redirecting...");
  });
});
