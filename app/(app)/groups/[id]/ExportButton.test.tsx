// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { ExportButton } from "./ExportButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("ExportButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("has correct aria-label", () => {
    render(<ExportButton groupId="test-group" />);
    expect(screen.getByLabelText("Export expenses to spreadsheet")).toBeTruthy();
  });

  it("disables button while loading", async () => {
    let resolveFetch: (value: Response) => void;
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; })
    );

    render(<ExportButton groupId="test-group" />);
    const button = screen.getByLabelText("Export expenses to spreadsheet");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveProperty("disabled", true);

    // Resolve to clean up
    await act(async () => {
      resolveFetch!(new Response(new Blob(), {
        headers: { "Content-Disposition": 'attachment; filename="test.xlsx"' },
      }));
    });
  });

  it("calls the correct API endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(new Blob(), {
        headers: { "Content-Disposition": 'attachment; filename="test.xlsx"' },
      })
    );

    render(<ExportButton groupId="my-group-123" />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Export expenses to spreadsheet"));
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/groups/my-group-123/export");
  });
});
