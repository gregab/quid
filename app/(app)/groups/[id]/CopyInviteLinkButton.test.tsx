// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { CopyInviteLinkButton } from "./CopyInviteLinkButton";

afterEach(cleanup);

const SITE_URL = "http://localhost:3000/aviary";

beforeEach(() => {
  // Mock clipboard
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
  // Provide NEXT_PUBLIC_SITE_URL
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("CopyInviteLinkButton", () => {
  it("renders the button", () => {
    render(<CopyInviteLinkButton inviteToken="abc123" />);
    expect(screen.getByRole("button", { name: /copy invite link/i })).toBeDefined();
  });

  it("copies the correct invite URL to clipboard on click", async () => {
    render(<CopyInviteLinkButton inviteToken="abc123" />);
    const button = screen.getByRole("button", { name: /copy invite link/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${SITE_URL}/invite/abc123`
    );
  });

  it("shows 'Copied!' feedback after clicking", async () => {
    vi.useFakeTimers();
    render(<CopyInviteLinkButton inviteToken="abc123" />);
    const button = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByRole("button").textContent).toBe("Copied!");

    // After 2 seconds, resets to original label
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button").textContent).toBe("Copy invite link");

    vi.useRealTimers();
  });
});
