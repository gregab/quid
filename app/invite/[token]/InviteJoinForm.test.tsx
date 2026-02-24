// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { InviteJoinForm } from "./InviteJoinForm";
import { useRouter } from "next/navigation";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

const SITE_URL = "http://localhost:3000";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("InviteJoinForm", () => {
  it("renders the group name and member count", () => {
    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    expect(screen.getByText("Road Trip")).toBeDefined();
    expect(screen.getByText("3 members")).toBeDefined();
  });

  it("renders singular 'member' for count of 1", () => {
    render(<InviteJoinForm token="abc123" groupName="Solo" memberCount={1} isAuthenticated={true} />);
    expect(screen.getByText("1 member")).toBeDefined();
  });

  it("renders join button with group name", () => {
    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    expect(screen.getByRole("button", { name: /join road trip/i })).toBeDefined();
  });

  it("calls the join API and redirects on success", async () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push, refresh: vi.fn() } as unknown as ReturnType<typeof useRouter>);

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { groupId: "group-1", alreadyMember: false }, error: null }),
    } as Response);

    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    const button = screen.getByRole("button", { name: /join road trip/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/invite/abc123/join",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows loading state while joining", async () => {
    // Never resolves — keeps loading state visible
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));

    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    const button = screen.getByRole("button");

    act(() => {
      fireEvent.click(button);
    });

    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("Joining…");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows error message on API failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ data: null, error: "Invalid invite token" }),
    } as Response);

    render(<InviteJoinForm token="bad-token" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    const button = screen.getByRole("button", { name: /join road trip/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText("Invalid invite token")).toBeDefined();
  });

  it("redirects to the correct group path after joining", async () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push, refresh: vi.fn() } as unknown as ReturnType<typeof useRouter>);

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { groupId: "group-1", alreadyMember: false }, error: null }),
    } as Response);

    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /join road trip/i }));
    });

    expect(push).toHaveBeenCalledWith("/groups/group-1");
  });

  it("redirects to the group even when alreadyMember is true", async () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push, refresh: vi.fn() } as unknown as ReturnType<typeof useRouter>);

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { groupId: "group-2", alreadyMember: true }, error: null }),
    } as Response);

    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /join road trip/i }));
    });

    expect(push).toHaveBeenCalledWith("/groups/group-2");
  });

  it("shows network error message when fetch throws", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fetch failed"));

    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /join road trip/i }));
    });

    expect(
      screen.getByText("Network error — please check your connection and try again.")
    ).toBeDefined();
  });

  it("shows fallback error message when response has no error field", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ data: null }),
    } as Response);

    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={true} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /join road trip/i }));
    });

    expect(screen.getByText("Something went wrong.")).toBeDefined();
  });

  it("shows sign-in and sign-up links when unauthenticated", () => {
    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={false} />);
    const signInLink = screen.getByRole("link", { name: /sign in to join/i });
    expect(signInLink).toBeDefined();
    expect((signInLink as HTMLAnchorElement).href).toContain("/login");
    expect((signInLink as HTMLAnchorElement).href).toContain(encodeURIComponent("/invite/abc123"));

    const signUpLink = screen.getByRole("link", { name: /sign up/i });
    expect(signUpLink).toBeDefined();
    expect((signUpLink as HTMLAnchorElement).href).toContain("/signup");
    expect((signUpLink as HTMLAnchorElement).href).toContain(encodeURIComponent("/invite/abc123"));
  });

  it("does not show join button when unauthenticated", () => {
    render(<InviteJoinForm token="abc123" groupName="Road Trip" memberCount={3} isAuthenticated={false} />);
    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
  });
});
