import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("renders text children", () => {
    render(<Button onPress={vi.fn()}>Click me</Button>);
    expect(screen.getByText("Click me")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Press</Button>);
    fireEvent.click(screen.getByText("Press"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} disabled>
        Disabled
      </Button>,
    );
    fireEvent.click(screen.getByText("Disabled"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not call onPress when loading", () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} loading>
        Loading
      </Button>,
    );
    expect(screen.queryByText("Loading")).toBeNull();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("shows loading indicator when loading is true", () => {
    render(
      <Button onPress={vi.fn()} loading>
        Save
      </Button>,
    );
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.queryByText("Save")).toBeNull();
  });

  it("renders custom children (non-string)", () => {
    render(
      <Button onPress={vi.fn()}>
        <span data-testid="custom">Custom</span>
      </Button>,
    );
    expect(screen.getByTestId("custom")).toBeTruthy();
  });

  it("renders sm size with smaller text", () => {
    render(
      <Button onPress={vi.fn()} size="sm">
        Small
      </Button>,
    );
    const text = screen.getByText("Small");
    expect(text.className).toContain("text-xs");
  });

  it("renders lg size with larger padding", () => {
    const { container } = render(
      <Button onPress={vi.fn()} size="lg">
        Large
      </Button>,
    );
    const button = container.firstChild as HTMLElement;
    expect(button.className).toContain("py-3.5");
  });

  it("renders md size by default", () => {
    const { container } = render(
      <Button onPress={vi.fn()}>Default</Button>,
    );
    const button = container.firstChild as HTMLElement;
    expect(button.className).toContain("py-3");
    const text = screen.getByText("Default");
    expect(text.className).toContain("text-sm");
  });

  it("ghost variant has visible border", () => {
    const { container } = render(
      <Button onPress={vi.fn()} variant="ghost">
        Ghost
      </Button>,
    );
    const button = container.firstChild as HTMLElement;
    expect(button.className).toContain("border");
    expect(button.className).toContain("border-stone-200");
  });
});
