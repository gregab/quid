// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { GroupSettingsModal } from "./GroupSettingsModal";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: "https://example.com/group-banners/g1/banner.jpg" },
});
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}));

vi.mock("@/lib/compressImage", () => ({
  compressImage: vi.fn().mockResolvedValue(new Blob(["fake"], { type: "image/jpeg" })),
}));

const defaultProps = {
  groupId: "g1",
  currentEmoji: null,
  currentBannerUrl: null,
  defaultEmoji: "🐦",
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ data: { id: "g1", emoji: null, bannerUrl: null }, error: null }),
  } as Response);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  defaultProps.onClose.mockReset();
  mockRefresh.mockReset();
});

describe("GroupSettingsModal", () => {
  it("renders emoji and banner sections", () => {
    render(<GroupSettingsModal {...defaultProps} />);
    expect(screen.getByText("Group emoji")).toBeTruthy();
    expect(screen.getByText("Banner image")).toBeTruthy();
  });

  it("shows default emoji in the preview when no custom emoji set", () => {
    render(<GroupSettingsModal {...defaultProps} />);
    // The preview tile shows the default emoji
    expect(screen.getByText("🐦")).toBeTruthy();
  });

  it("shows current emoji in the input when one is set", () => {
    render(<GroupSettingsModal {...defaultProps} currentEmoji="🦜" />);
    const input = screen.getByPlaceholderText("Default: 🐦") as HTMLInputElement;
    expect(input.value).toBe("🦜");
  });

  it("accepts a valid emoji", () => {
    render(<GroupSettingsModal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Default: 🐦") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "🦜" } });
    expect(input.value).toBe("🦜");
  });

  it("rejects plain text characters", () => {
    render(<GroupSettingsModal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Default: 🐦") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input.value).toBe("");
  });

  it("trims to the first grapheme cluster when multiple emojis are pasted", () => {
    render(<GroupSettingsModal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Default: 🐦") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "🦜🐦🦅" } });
    expect(input.value).toBe("🦜");
  });

  it("shows Reset button when emoji is set and clears it", () => {
    render(<GroupSettingsModal {...defaultProps} currentEmoji="🦜" />);
    const reset = screen.getByText("Reset");
    fireEvent.click(reset);
    const input = screen.getByPlaceholderText("Default: 🐦") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("calls PUT /api/groups/g1/settings with correct payload on save", async () => {
    render(<GroupSettingsModal {...defaultProps} currentEmoji="🦜" />);

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/groups/g1/settings",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ emoji: "🦜", bannerUrl: null }),
      })
    );
  });

  it("sends null emoji when field is blank (revert to default)", async () => {
    render(<GroupSettingsModal {...defaultProps} currentEmoji="🦜" />);
    const input = screen.getByPlaceholderText("Default: 🐦") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/groups/g1/settings",
      expect.objectContaining({
        body: JSON.stringify({ emoji: null, bannerUrl: null }),
      })
    );
  });

  it("calls onClose and router.refresh after successful save", async () => {
    render(<GroupSettingsModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(mockRefresh).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows error message when API returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not a member of this group" }),
    } as Response);

    render(<GroupSettingsModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(screen.getByText("Not a member of this group")).toBeTruthy();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("closes when backdrop is clicked", () => {
    const { container } = render(<GroupSettingsModal {...defaultProps} />);
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("closes when X button is clicked", () => {
    render(<GroupSettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows Remove button and clears banner when banner is set", () => {
    render(
      <GroupSettingsModal
        {...defaultProps}
        currentBannerUrl="https://example.com/banner.jpg"
      />
    );
    expect(screen.getByText("Remove")).toBeTruthy();
    fireEvent.click(screen.getByText("Remove"));
    // After removal, the upload area should appear
    expect(screen.getByText("Upload banner")).toBeTruthy();
  });

  it("shows pan UI when a file is selected", async () => {
    render(<GroupSettingsModal {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText("Drag to reposition")).toBeTruthy();
    // Upload button should be hidden during pan
    expect(screen.queryByText("Upload banner")).toBeNull();
  });

  it("cancels pan UI and returns to upload button", async () => {
    render(<GroupSettingsModal {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText("Drag to reposition")).toBeTruthy();

    // The pan Cancel is inside the pan container (not the footer Cancel)
    const panContainer = screen.getByTestId("pan-container").parentElement!;
    const cancelBtn = panContainer.querySelector("button") as HTMLButtonElement;
    fireEvent.click(cancelBtn);
    expect(screen.queryByText("Drag to reposition")).toBeNull();
    expect(screen.getByText("Upload banner")).toBeTruthy();
  });

  it("uploads when Save is clicked with a pending crop", async () => {
    // Mock canvas — save original to avoid recursive call
    const originalCreateElement = document.createElement.bind(document);
    const mockGetContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    });
    const mockToBlob = vi.fn((cb: (b: Blob) => void) =>
      cb(new Blob(["cropped"], { type: "image/jpeg" }))
    );
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") {
        const canvas = originalCreateElement("canvas") as HTMLCanvasElement;
        Object.defineProperty(canvas, "getContext", { value: mockGetContext });
        Object.defineProperty(canvas, "toBlob", { value: mockToBlob });
        return canvas;
      }
      return originalCreateElement(tag);
    });

    render(<GroupSettingsModal {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Simulate image load in pan container
    const panImg = screen.getByAltText("Position your banner") as HTMLImageElement;
    Object.defineProperty(panImg, "naturalWidth", { value: 800 });
    Object.defineProperty(panImg, "naturalHeight", { value: 600 });
    fireEvent.load(panImg);

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
    });

    // Modal should have closed (pan UI gone)
    expect(screen.queryByText("Drag to reposition")).toBeNull();
  });

  it("sends null bannerUrl when banner is removed", async () => {
    render(
      <GroupSettingsModal
        {...defaultProps}
        currentBannerUrl="https://example.com/banner.jpg"
      />
    );
    fireEvent.click(screen.getByText("Remove"));

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/groups/g1/settings",
      expect.objectContaining({
        body: expect.stringContaining('"bannerUrl":null'),
      })
    );
  });
});
