import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("px-4");
    expect(card.className).toContain("py-3");
  });

  it("default variant has border and shadow", () => {
    const { container } = render(<Card>Default</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border");
    expect(card.className).toContain("shadow-sm");
  });

  it("flat variant has no border or shadow", () => {
    const { container } = render(<Card variant="flat">Flat</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("border");
    expect(card.className).not.toContain("shadow");
  });

  it("elevated variant has stronger shadow", () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("shadow-md");
  });

  it("pressable card calls onPress", () => {
    const onPress = vi.fn();
    render(
      <Card pressable onPress={onPress}>
        Pressable card
      </Card>,
    );
    fireEvent.click(screen.getByText("Pressable card"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
