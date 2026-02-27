import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemberPill } from "./MemberPill";

afterEach(cleanup);

describe("MemberPill", () => {
  it("renders emoji and display name", () => {
    render(<MemberPill emoji="🦊" displayName="Alice" />);
    expect(screen.getByText("🦊")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("truncates long names", () => {
    render(
      <MemberPill emoji="🐼" displayName="A Very Long Display Name" />,
    );
    expect(screen.getByText("A Very Long Display Name")).toBeTruthy();
  });

  it("renders avatar image instead of emoji when avatarUrl is provided", () => {
    render(
      <MemberPill
        emoji="🦊"
        displayName="Alice"
        avatarUrl="https://example.com/alice.jpg"
      />,
    );
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe("https://example.com/alice.jpg");
    // Emoji should not be rendered when image is shown
    expect(screen.queryByText("🦊")).toBeNull();
  });

  it("renders emoji when avatarUrl is null", () => {
    render(
      <MemberPill emoji="🦊" displayName="Alice" avatarUrl={null} />,
    );
    expect(screen.getByText("🦊")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });
});
