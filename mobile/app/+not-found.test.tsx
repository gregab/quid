import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useRouter } from "expo-router";
import NotFoundScreen from "./+not-found";

afterEach(cleanup);

describe("NotFoundScreen", () => {
  it("renders branded 404 with Aviary logo and bird emoji", () => {
    render(<NotFoundScreen />);
    expect(screen.getByText("Aviary")).toBeTruthy();
    expect(screen.getByText("🐦")).toBeTruthy();
    expect(screen.getByText("Looks like this nest is empty")).toBeTruthy();
  });

  it("renders explanation text", () => {
    render(<NotFoundScreen />);
    expect(
      screen.getByText("We couldn't find the page you were looking for."),
    ).toBeTruthy();
  });

  it("navigates to dashboard on button press", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      replace,
      push: vi.fn(),
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);

    render(<NotFoundScreen />);
    fireEvent.click(screen.getByTestId("back-to-dashboard"));
    expect(replace).toHaveBeenCalledWith("/(app)/(dashboard)");
  });
});
