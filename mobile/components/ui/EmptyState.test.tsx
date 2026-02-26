import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders icon, title, and subtitle", () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">🪺</span>}
        title="No items"
        subtitle="Add some items to get started"
      />,
    );
    expect(screen.getByTestId("icon")).toBeTruthy();
    expect(screen.getByText("No items")).toBeTruthy();
    expect(screen.getByText("Add some items to get started")).toBeTruthy();
  });

  it("renders without subtitle", () => {
    render(
      <EmptyState
        icon={<span>🐦</span>}
        title="Empty"
      />,
    );
    expect(screen.getByText("Empty")).toBeTruthy();
  });

  it("renders action button when provided", () => {
    const onPress = vi.fn();
    render(
      <EmptyState
        icon={<span>🐦</span>}
        title="No groups"
        action={{ label: "Create group", onPress }}
      />,
    );
    const button = screen.getByText("Create group");
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not render action button when not provided", () => {
    render(
      <EmptyState
        icon={<span>🐦</span>}
        title="Nothing here"
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
