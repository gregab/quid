// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { LeaveGroupButton } from "./LeaveGroupButton";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ data: { deletedGroup: false }, error: null }),
  } as Response);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockPush.mockReset();
});

describe("LeaveGroupButton", () => {
  it("renders the leave group trigger", () => {
    render(<LeaveGroupButton groupId="g1" />);
    expect(screen.getByText("Leave group")).toBeDefined();
  });

  it("opens confirmation dialog on click", () => {
    render(<LeaveGroupButton groupId="g1" />);
    fireEvent.click(screen.getByText("Leave group"));
    expect(screen.getByText("Leave group?")).toBeDefined();
    expect(screen.getByText("Leave")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("closes dialog when Cancel is clicked", () => {
    render(<LeaveGroupButton groupId="g1" />);
    fireEvent.click(screen.getByText("Leave group"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Leave group?")).toBeNull();
  });

  it("calls DELETE and redirects to dashboard on success", async () => {
    render(<LeaveGroupButton groupId="g1" />);
    fireEvent.click(screen.getByText("Leave group"));

    await act(async () => {
      fireEvent.click(screen.getByText("Leave"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/groups/g1/members"),
      expect.objectContaining({ method: "DELETE" })
    );
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows error message when API returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ data: null, error: "Cannot leave group: you owe $15. Please settle up first." }),
    } as Response);

    render(<LeaveGroupButton groupId="g1" />);
    fireEvent.click(screen.getByText("Leave group"));

    await act(async () => {
      fireEvent.click(screen.getByText("Leave"));
    });

    expect(screen.getByText("Cannot leave group: you owe $15. Please settle up first.")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
