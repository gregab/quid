import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Toast } from "./Toast";

afterEach(cleanup);

describe("Toast", () => {
  it("renders message text", () => {
    render(
      <Toast
        message="Expense added!"
        type="success"
        duration={3000}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Expense added!")).toBeTruthy();
  });

  it("renders success variant with emerald colors", () => {
    const { container } = render(
      <Toast
        message="Done"
        type="success"
        duration={3000}
        onDismiss={vi.fn()}
      />,
    );
    const pressable = container.querySelector("[class]") as HTMLElement;
    // The outer animated wrapper contains the pressable with emerald styling
    const inner = screen.getByText("Done").parentElement as HTMLElement;
    expect(inner.className).toContain("bg-emerald-50");
    expect(inner.className).toContain("border-emerald-200");
  });

  it("renders error variant with rose colors", () => {
    render(
      <Toast
        message="Failed"
        type="error"
        duration={3000}
        onDismiss={vi.fn()}
      />,
    );
    const inner = screen.getByText("Failed").parentElement as HTMLElement;
    expect(inner.className).toContain("bg-rose-50");
    expect(inner.className).toContain("border-rose-200");
  });

  it("renders info variant with amber colors", () => {
    render(
      <Toast
        message="Note"
        type="info"
        duration={3000}
        onDismiss={vi.fn()}
      />,
    );
    const inner = screen.getByText("Note").parentElement as HTMLElement;
    expect(inner.className).toContain("bg-amber-50");
    expect(inner.className).toContain("border-amber-200");
  });

  it("calls onDismiss when pressed", () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Tap me"
        type="success"
        duration={3000}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByText("Tap me"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses after duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Auto"
        type="info"
        duration={2000}
        onDismiss={onDismiss}
      />,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("has testID for querying", () => {
    render(
      <Toast
        message="Test"
        type="success"
        duration={3000}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId("toast")).toBeTruthy();
  });
});
