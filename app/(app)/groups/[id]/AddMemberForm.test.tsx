// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { AddMemberForm } from "./AddMemberForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

const SITE_URL = "http://localhost:3000";

beforeEach(() => {
  Object.defineProperty(navigator, "share", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AddMemberForm modal", () => {
  it("opens the modal when '+ add member' is clicked", () => {
    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));
    expect(screen.getByText("Add a member")).toBeDefined();
  });

  it("shows the copy invite link button inside the modal", () => {
    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));
    expect(screen.getByText("Copy invite link")).toBeDefined();
  });

  it("shows the email form inside the modal", () => {
    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));
    expect(screen.getByLabelText("Add by email")).toBeDefined();
  });

  it("copies invite link when copy button is clicked (no navigator.share)", async () => {
    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));

    await act(async () => {
      fireEvent.click(screen.getByText("Copy invite link"));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${SITE_URL}/invite/tok1`
    );
  });

  it("calls navigator.share when available", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });

    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));

    // Wait for useEffect to set canShare
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByText("Share invite link"));
    });

    expect(navigator.share).toHaveBeenCalledWith({
      url: `${SITE_URL}/invite/tok1`,
    });
  });

  it("shows email validation error for invalid email", async () => {
    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));

    const input = screen.getByLabelText("Add by email");
    fireEvent.change(input, { target: { value: "notanemail" } });

    await act(async () => {
      fireEvent.submit(screen.getByText("Add member").closest("form")!);
    });

    expect(screen.getByText("Please enter a valid email address.")).toBeDefined();
  });

  it("shows error for empty email submission", async () => {
    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));

    await act(async () => {
      fireEvent.submit(screen.getByText("Add member").closest("form")!);
    });

    expect(screen.getByText("Please enter an email address.")).toBeDefined();
  });

  it("closes modal on cancel", () => {
    render(<AddMemberForm groupId="g1" inviteToken="tok1" />);
    fireEvent.click(screen.getByText("+ add member"));
    expect(screen.getByText("Add a member")).toBeDefined();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Add a member")).toBeNull();
  });
});
