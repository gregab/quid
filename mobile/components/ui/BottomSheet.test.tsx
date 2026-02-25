import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Sheet } from "./BottomSheet";

afterEach(cleanup);

describe("Sheet", () => {
  it("renders children", () => {
    render(
      <Sheet>
        <span>Sheet content</span>
      </Sheet>,
    );
    expect(screen.getByText("Sheet content")).toBeTruthy();
  });

  it("accepts custom snap points", () => {
    // Verify the component renders without error when custom snapPoints are passed
    render(
      <Sheet snapPoints={["25%", "50%", "90%"]}>
        <span>Custom snaps</span>
      </Sheet>,
    );
    expect(screen.getByText("Custom snaps")).toBeTruthy();
  });

  it("accepts a ref", () => {
    const ref = { current: null };
    render(
      <Sheet ref={ref}>
        <span>With ref</span>
      </Sheet>,
    );
    expect(screen.getByText("With ref")).toBeTruthy();
  });
});
