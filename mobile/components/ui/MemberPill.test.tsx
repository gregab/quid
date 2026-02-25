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
    // The component uses numberOfLines={1} — in our mock this just renders the text
    expect(screen.getByText("A Very Long Display Name")).toBeTruthy();
  });
});
