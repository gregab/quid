// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { CopyInviteLinkButton } from "./CopyInviteLinkButton";

afterEach(cleanup);

const SITE_URL = "http://localhost:3000";

beforeEach(() => {
  // Ensure navigator.share is absent by default (clipboard path)
  Object.defineProperty(navigator, "share", {
    value: undefined,
    writable: true,
    configurable: true,
  });
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

describe("CopyInviteLinkButton — clipboard (no navigator.share)", () => {
  it("renders the button with 'Copy invite link' label", () => {
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

describe("CopyInviteLinkButton — share sheet (navigator.share available)", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });
  });

  it("renders the button with 'Share invite' label", async () => {
    render(<CopyInviteLinkButton inviteToken="abc123" />);
    // useEffect sets canShare after mount
    await act(async () => {});
    expect(screen.getByRole("button", { name: /share invite/i })).toBeDefined();
  });

  it("calls navigator.share with the correct invite URL", async () => {
    render(<CopyInviteLinkButton inviteToken="abc123" />);
    await act(async () => {});
    const button = screen.getByRole("button", { name: /share invite/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.share).toHaveBeenCalledWith({
      url: `${SITE_URL}/invite/abc123`,
    });
  });

  it("does not write to clipboard when navigator.share is available", async () => {
    render(<CopyInviteLinkButton inviteToken="abc123" />);
    await act(async () => {});
    const button = screen.getByRole("button", { name: /share invite/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
