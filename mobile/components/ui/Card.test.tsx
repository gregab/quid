import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Card } from "./Card";

afterEach(cleanup);

describe("Card", () => {
  it("renders children", () => {
    render(
      <Card>
        <span>Hello</span>
      </Card>,
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("accepts additional className", () => {
    const { container } = render(<Card className="px-4 py-3">Content</Card>);
    // The outer div should contain our custom class
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("px-4");
    expect(card.className).toContain("py-3");
  });
});
