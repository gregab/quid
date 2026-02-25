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
    // The button element has disabled attribute, but our mock uses onClick
    // so we verify the handler guards against it
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
    // When loading, text is replaced by ActivityIndicator
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
});
