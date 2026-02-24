// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemberPill } from "./MemberPill";

describe("MemberPill", () => {
  it("renders name and emoji when no avatarUrl", () => {
    render(<MemberPill name="Alice" emoji="🦊" />);
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("🦊")).toBeDefined();
  });

  it("renders avatar image when avatarUrl is provided", () => {
    const { container } = render(
      <MemberPill name="Bob" emoji="🐼" avatarUrl="https://example.com/pic.jpg" />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/pic.jpg");
    // Emoji should NOT be rendered when avatar is showing
    expect(screen.queryByText("🐼")).toBeNull();
  });

  it("falls back to emoji when avatarUrl image fails to load", () => {
    const { container } = render(
      <MemberPill name="Carol" emoji="🧙" avatarUrl="https://example.com/broken.jpg" />
    );
    const img = container.querySelector("img");
    expect(img).toBeDefined();

    // Simulate image load error
    fireEvent.error(img!);

    // Now emoji should show and img should be gone
    expect(screen.getByText("🧙")).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders emoji when avatarUrl is null", () => {
    const { container } = render(<MemberPill name="Dave" emoji="🦄" avatarUrl={null} />);
    expect(screen.getByText("🦄")).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders suffix when provided", () => {
    render(<MemberPill name="Eve" suffix="· you" />);
    expect(screen.getByText("· you")).toBeDefined();
  });

  it("applies color classes when provided", () => {
    const { container } = render(
      <MemberPill
        name="Frank"
        color={{ bg: "bg-rose-100", text: "text-rose-700" }}
      />
    );
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.className).toContain("bg-rose-100");
    expect(pill.className).toContain("text-rose-700");
  });
});
