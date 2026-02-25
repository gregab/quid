import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Avatar } from "./Avatar";

afterEach(cleanup);

describe("Avatar", () => {
  it("renders default emoji when no props given", () => {
    render(<Avatar />);
    expect(screen.getByText("🐦")).toBeTruthy();
  });

  it("renders custom emoji", () => {
    render(<Avatar emoji="🦊" />);
    expect(screen.getByText("🦊")).toBeTruthy();
  });

  it("renders image when imageUrl is provided", () => {
    render(<Avatar imageUrl="https://example.com/photo.jpg" />);
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe("https://example.com/photo.jpg");
  });

  it("prefers image over emoji", () => {
    render(
      <Avatar imageUrl="https://example.com/photo.jpg" emoji="🦊" />,
    );
    // Should show image, not emoji
    expect(document.querySelector("img")).toBeTruthy();
    expect(screen.queryByText("🦊")).toBeNull();
  });
});
