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
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    expect(screen.getByText("Leave group")).toBeDefined();
  });

  it("opens confirmation dialog on click", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));
    expect(screen.getByText("Leave group?")).toBeDefined();
    expect(screen.getByText("Leave")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("closes dialog when Cancel is clicked", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Leave group?")).toBeNull();
  });

  it("calls DELETE and redirects to dashboard on success", async () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
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

    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));

    await act(async () => {
      fireEvent.click(screen.getByText("Leave"));
    });

    expect(screen.getByText("Cannot leave group: you owe $15. Please settle up first.")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows warning and disables Leave button when user owes any amount", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={50} />);
    fireEvent.click(screen.getByText("Leave group"));

    expect(screen.getByText("You owe $0.50 in this group. Please settle up before leaving.")).toBeDefined();
    const leaveBtn = screen.getByText("Leave");
    expect(leaveBtn.closest("button")!.hasAttribute("disabled")).toBe(true);
  });

  it("allows leaving when user owes nothing", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));

    expect(screen.queryByText(/You owe/)).toBeNull();
    const leaveBtn = screen.getByText("Leave");
    expect(leaveBtn.closest("button")!.hasAttribute("disabled")).toBe(false);
  });

  it("allows leaving when user is owed money (positive creditor balance)", () => {
    // userOwedCents=0 means the user doesn't OWE anything (they might be owed)
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));

    expect(screen.queryByText(/You owe/)).toBeNull();
    const leaveBtn = screen.getByText("Leave");
    expect(leaveBtn.closest("button")!.hasAttribute("disabled")).toBe(false);
  });

  it("shows correct dollar amount formatting in the owed warning", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={12350} />);
    fireEvent.click(screen.getByText("Leave group"));
    expect(screen.getByText("You owe $123.50 in this group. Please settle up before leaving.")).toBeDefined();
  });

  it("shows 'Leaving...' text while the API call is in progress", async () => {
    // Create a fetch that never resolves during the test
    let resolveFetch: () => void;
    vi.spyOn(global, "fetch").mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = () => resolve({
          ok: true,
          json: async () => ({ data: { deletedGroup: false }, error: null }),
        } as Response);
      })
    );

    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));

    await act(async () => {
      fireEvent.click(screen.getByText("Leave"));
    });

    expect(screen.getByText("Leaving...")).toBeDefined();

    // Resolve to clean up
    await act(async () => {
      resolveFetch!();
    });
  });
});

// ─── Balance computation for leave eligibility ──────────────────────────────

describe("LeaveGroupButton — balance-based eligibility scenarios", () => {
  it("blocks leaving with even a 1-cent debt", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={1} />);
    fireEvent.click(screen.getByText("Leave group"));

    expect(screen.getByText("You owe $0.01 in this group. Please settle up before leaving.")).toBeDefined();
    const leaveBtn = screen.getByText("Leave");
    expect(leaveBtn.closest("button")!.hasAttribute("disabled")).toBe(true);
  });

  it("shows the normal confirmation message when user has zero balance", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));

    expect(screen.getByText(/no longer see this group/)).toBeDefined();
    expect(screen.queryByText(/You owe/)).toBeNull();
  });

  it("warns about group deletion when user might be the last member", () => {
    render(<LeaveGroupButton groupId="g1" userOwedCents={0} />);
    fireEvent.click(screen.getByText("Leave group"));

    // The warning message mentions the group will be deleted if last member
    expect(screen.getByText(/last member.*deleted/)).toBeDefined();
  });
});
