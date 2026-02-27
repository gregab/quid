import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Avatar } from "./Avatar";

afterEach(cleanup);

describe("Avatar", () => {
  it("renders empty text when no props given (no bird fallback)", () => {
    render(<Avatar />);
    // Should NOT render 🐦
    expect(screen.queryByText("🐦")).toBeNull();
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
    expect(document.querySelector("img")).toBeTruthy();
    expect(screen.queryByText("🦊")).toBeNull();
  });

  it("prefers profilePictureUrl over imageUrl", () => {
    render(
      <Avatar
        profilePictureUrl="https://example.com/profile.jpg"
        imageUrl="https://example.com/google.jpg"
        emoji="🦊"
      />,
    );
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe("https://example.com/profile.jpg");
    expect(screen.queryByText("🦊")).toBeNull();
  });

  it("falls back to imageUrl when profilePictureUrl is null", () => {
    render(
      <Avatar
        profilePictureUrl={null}
        imageUrl="https://example.com/google.jpg"
        emoji="🦊"
      />,
    );
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe("https://example.com/google.jpg");
  });

  it("falls back to emoji when no image URLs are provided", () => {
    render(
      <Avatar profilePictureUrl={null} imageUrl={null} emoji="🦊" />,
    );
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("🦊")).toBeTruthy();
  });
});
