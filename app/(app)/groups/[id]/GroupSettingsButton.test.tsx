// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GroupSettingsButton } from "./GroupSettingsButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/banner.jpg" } }),
      }),
    },
  }),
}));

vi.mock("@/lib/compressImage", () => ({
  compressImage: vi.fn().mockResolvedValue(new Blob(["fake"], { type: "image/jpeg" })),
}));

vi.spyOn(global, "fetch").mockResolvedValue({
  ok: true,
  json: async () => ({ data: {}, error: null }),
} as Response);

afterEach(cleanup);

describe("GroupSettingsButton", () => {
  it("renders a gear icon button", () => {
    render(
      <GroupSettingsButton
        groupId="g1"
        currentBannerUrl={null}
      />
    );
    expect(screen.getByRole("button", { name: "Group settings" })).toBeTruthy();
  });

  it("opens the settings modal on click", () => {
    render(
      <GroupSettingsButton
        groupId="g1"
        currentBannerUrl={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Group settings" }));
    expect(screen.getByText("Group settings")).toBeTruthy();
  });

  it("closes the modal when Cancel is clicked", () => {
    render(
      <GroupSettingsButton
        groupId="g1"
        currentBannerUrl={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Group settings" }));
    expect(screen.getByText("Group settings")).toBeTruthy();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Banner image")).toBeNull();
  });
});
