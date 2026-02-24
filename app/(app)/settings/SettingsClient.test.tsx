// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { SettingsClient } from "./SettingsClient";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const BASE_PROPS = { email: "alice@example.com" };

/** Mock GET /api/account to return the given balances */
function mockBalanceFetch(
  balances: { groupId: string; groupName: string; balanceCents: number }[] = []
) {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ data: { groupBalances: balances }, error: null }),
  } as Response);
}

/** Open the confirmation modal and wait for balances to load */
async function openModal(balances: { groupId: string; groupName: string; balanceCents: number }[] = []) {
  const fetchSpy = mockBalanceFetch(balances);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
  });
  return fetchSpy;
}

describe("SettingsClient", () => {
  it("renders the account email", () => {
    render(<SettingsClient {...BASE_PROPS} />);
    expect(screen.getByText("alice@example.com")).toBeDefined();
  });

  it("renders the delete account button", () => {
    render(<SettingsClient {...BASE_PROPS} />);
    expect(screen.getByRole("button", { name: /delete account/i })).toBeDefined();
  });

  it("opens confirmation modal when delete button is clicked", async () => {
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal();
    expect(screen.getByText("Delete your account?")).toBeDefined();
    expect(screen.getByPlaceholderText("FAREWELL")).toBeDefined();
  });

  it("disables confirm button until user types FAREWELL", async () => {
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal();

    const confirmBtn = screen.getByRole("button", { name: /delete my account/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("FAREWELL"), { target: { value: "FAREWELL" } });
    expect(confirmBtn.disabled).toBe(false);
  });

  it("does not enable confirm button with wrong text", async () => {
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal();

    fireEvent.change(screen.getByPlaceholderText("FAREWELL"), { target: { value: "farewell" } });
    const confirmBtn = screen.getByRole("button", { name: /delete my account/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it("does not enable confirm button when typing DELETE (old word)", async () => {
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal();

    fireEvent.change(screen.getByPlaceholderText("FAREWELL"), { target: { value: "DELETE" } });
    const confirmBtn = screen.getByRole("button", { name: /delete my account/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it("shows blocking message and group list when user has outstanding balances", async () => {
    const balances = [
      { groupId: "g1", groupName: "Trip", balanceCents: 1500 },
      { groupId: "g2", groupName: "Rent", balanceCents: -2000 },
    ];
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal(balances);

    expect(screen.getByText(/You must settle up before deleting your account/)).toBeDefined();
    expect(screen.getByText(/Trip/)).toBeDefined();
    expect(screen.getByText(/you are owed \$15\.00/)).toBeDefined();
    expect(screen.getByText(/Rent/)).toBeDefined();
    expect(screen.getByText(/you owe \$20\.00/)).toBeDefined();
  });

  it("hides confirmation input and delete button when balances exist", async () => {
    const balances = [{ groupId: "g1", groupName: "Trip", balanceCents: 1500 }];
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal(balances);

    expect(screen.queryByPlaceholderText("FAREWELL")).toBeNull();
    expect(screen.queryByRole("button", { name: /delete my account/i })).toBeNull();
  });

  it("shows Close button (not Cancel) when balances exist", async () => {
    const balances = [{ groupId: "g1", groupName: "Trip", balanceCents: 1500 }];
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal(balances);

    expect(screen.getByRole("button", { name: /close/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("does not show balance warnings when no outstanding balances", async () => {
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal([]);

    expect(screen.queryByText(/settle up/)).toBeNull();
  });

  it("calls DELETE /api/account on confirm", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { groupBalances: [] }, error: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { deleted: true }, error: null }),
      } as Response);

    render(<SettingsClient {...BASE_PROPS} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    });

    fireEvent.change(screen.getByPlaceholderText("FAREWELL"), { target: { value: "FAREWELL" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/account"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("shows error message on API failure", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { groupBalances: [] }, error: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ data: null, error: "Something went wrong" }),
      } as Response);

    render(<SettingsClient {...BASE_PROPS} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    });

    fireEvent.change(screen.getByPlaceholderText("FAREWELL"), { target: { value: "FAREWELL" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));
    });

    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("closes modal when cancel is clicked", async () => {
    render(<SettingsClient {...BASE_PROPS} />);
    await openModal();
    expect(screen.getByText("Delete your account?")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText("Delete your account?")).toBeNull();
  });
});
