import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LoadMoreButton } from "./LoadMoreButton";

afterEach(cleanup);

describe("LoadMoreButton", () => {
  it("renders with default label", () => {
    render(<LoadMoreButton onPress={vi.fn()} />);
    expect(screen.getByText("Load more")).toBeTruthy();
  });

  it("renders with custom label", () => {
    render(<LoadMoreButton onPress={vi.fn()} label="Show more (10 remaining)" />);
    expect(screen.getByText("Show more (10 remaining)")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = vi.fn();
    render(<LoadMoreButton onPress={onPress} />);
    fireEvent.click(screen.getByTestId("load-more-button"));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("shows spinner when loading", () => {
    render(<LoadMoreButton onPress={vi.fn()} loading />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("disables button when loading", () => {
    const onPress = vi.fn();
    render(<LoadMoreButton onPress={onPress} loading />);
    fireEvent.click(screen.getByTestId("load-more-button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
