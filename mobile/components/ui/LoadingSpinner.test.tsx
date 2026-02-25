import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LoadingSpinner } from "./LoadingSpinner";

afterEach(cleanup);

describe("LoadingSpinner", () => {
  it("renders activity indicator", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("shows text when provided", () => {
    render(<LoadingSpinner text="Loading groups..." />);
    expect(screen.getByText("Loading groups...")).toBeTruthy();
  });

  it("does not show text when not provided", () => {
    render(<LoadingSpinner />);
    // Only the progressbar, no text
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
