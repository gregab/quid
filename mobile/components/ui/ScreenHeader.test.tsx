import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
}));

import { ScreenHeader } from "./ScreenHeader";

afterEach(cleanup);

describe("ScreenHeader", () => {
  it("renders title text", () => {
    render(<ScreenHeader title="My Group" />);
    expect(screen.getByText("My Group")).toBeTruthy();
  });

  it("renders back button when onBack is provided", () => {
    const onBack = vi.fn();
    render(<ScreenHeader title="Details" onBack={onBack} />);
    const backBtn = screen.getByText("Back");
    expect(backBtn).toBeTruthy();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders Aviary logo when no onBack", () => {
    render(<ScreenHeader title="Dashboard" />);
    expect(screen.getByText("Aviary")).toBeTruthy();
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("renders right action slot", () => {
    render(
      <ScreenHeader
        title="Group"
        rightAction={<span data-testid="gear">Settings</span>}
      />,
    );
    expect(screen.getByTestId("gear")).toBeTruthy();
  });

  it("renders subtitle when provided", () => {
    render(<ScreenHeader title="Group" subtitle="3 members" />);
    expect(screen.getByText("3 members")).toBeTruthy();
  });
});
