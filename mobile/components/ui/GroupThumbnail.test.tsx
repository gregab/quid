import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GroupThumbnail } from "./GroupThumbnail";

afterEach(cleanup);

describe("GroupThumbnail", () => {
  it("renders with default bird emoji when no emoji provided", () => {
    render(<GroupThumbnail colorIndex={0} />);
    expect(screen.getByText("🐦")).toBeTruthy();
  });

  it("renders with custom emoji", () => {
    render(<GroupThumbnail emoji="🏠" colorIndex={3} />);
    expect(screen.getByText("🏠")).toBeTruthy();
  });

  it("renders default bird emoji when emoji is null", () => {
    render(<GroupThumbnail emoji={null} colorIndex={0} />);
    expect(screen.getByText("🐦")).toBeTruthy();
  });

  it("renders with correct size (default md = 44px)", () => {
    render(<GroupThumbnail colorIndex={0} />);
    const thumb = screen.getByTestId("group-thumbnail");
    expect(thumb.style.width).toBe("44px");
    expect(thumb.style.height).toBe("44px");
  });

  it("renders with sm size (36px)", () => {
    render(<GroupThumbnail colorIndex={0} size="sm" />);
    const thumb = screen.getByTestId("group-thumbnail");
    expect(thumb.style.width).toBe("36px");
    expect(thumb.style.height).toBe("36px");
  });

  it("renders with lg size (56px)", () => {
    render(<GroupThumbnail colorIndex={0} size="lg" />);
    const thumb = screen.getByTestId("group-thumbnail");
    expect(thumb.style.width).toBe("56px");
    expect(thumb.style.height).toBe("56px");
  });

  it("applies background color from group color system", () => {
    render(<GroupThumbnail colorIndex={0} />);
    const thumb = screen.getByTestId("group-thumbnail");
    // In light mode (default), honeycomb bg = #fef3c7
    expect(thumb.style.backgroundColor).toBe("#fef3c7");
  });

  it("wraps color index for large values", () => {
    render(<GroupThumbnail colorIndex={12} />);
    const thumb = screen.getByTestId("group-thumbnail");
    // Index 12 wraps to 0 = honeycomb bg
    expect(thumb.style.backgroundColor).toBe("#fef3c7");
  });
});
