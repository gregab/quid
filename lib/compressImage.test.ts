import { describe, it, expect } from "vitest";
import { calculateDimensions } from "./compressImage";

describe("calculateDimensions", () => {
  it("returns original size when image fits within bounds", () => {
    expect(calculateDimensions(800, 300)).toEqual({ width: 800, height: 300 });
  });

  it("does not upscale small images", () => {
    expect(calculateDimensions(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it("scales down wide images constrained by width", () => {
    const { width, height } = calculateDimensions(2400, 400);
    expect(width).toBe(1200);
    expect(height).toBe(200);
  });

  it("scales down tall images constrained by height", () => {
    const { width, height } = calculateDimensions(800, 800);
    expect(width).toBe(400);
    expect(height).toBe(400);
  });

  it("scales down image constrained by both dimensions — height wins", () => {
    // 3600×1200 → width ratio = 1200/3600 = 1/3, height ratio = 400/1200 = 1/3
    const { width, height } = calculateDimensions(3600, 1200);
    expect(width).toBe(1200);
    expect(height).toBe(400);
  });

  it("handles exact max dimensions without scaling", () => {
    expect(calculateDimensions(1200, 400)).toEqual({ width: 1200, height: 400 });
  });

  it("preserves aspect ratio when width is the binding constraint", () => {
    const { width, height } = calculateDimensions(2400, 200);
    expect(width).toBe(1200);
    expect(height).toBe(100);
  });
});
