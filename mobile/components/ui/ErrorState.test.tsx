import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ErrorState } from "./ErrorState";

afterEach(cleanup);

describe("ErrorState", () => {
  it("renders the default error message", () => {
    render(<ErrorState />);
    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeTruthy();
  });

  it("renders a custom error message", () => {
    render(<ErrorState message="Network error occurred." />);
    expect(screen.getByText("Network error occurred.")).toBeTruthy();
  });

  it("renders the retry button when onRetry is provided", () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("does not render the retry button when onRetry is not provided", () => {
    render(<ErrorState />);
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("calls onRetry when the retry button is pressed", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
