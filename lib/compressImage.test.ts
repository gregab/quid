import { describe, it, expect } from "vitest";
import { calculateDimensions, MAX_FILE_BYTES, QUALITY_LADDER } from "./compressImage";

describe("calculateDimensions", () => {
  it("returns original size when image fits within bounds", () => {
    expect(calculateDimensions(800, 300)).toEqual({ width: 800, height: 300 });
  });

  it("does not upscale small images", () => {
    expect(calculateDimensions(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it("scales down wide images constrained by width", () => {
    // 4800×400 → width ratio = 0.5, height ratio = 2 → ratio = 0.5
    const { width, height } = calculateDimensions(4800, 400);
    expect(width).toBe(2400);
    expect(height).toBe(200);
  });

  it("scales down tall images constrained by height", () => {
    // 800×1600 → width ratio = 3, height ratio = 0.5 → ratio = 0.5
    const { width, height } = calculateDimensions(800, 1600);
    expect(width).toBe(400);
    expect(height).toBe(800);
  });

  it("scales down image constrained by both dimensions", () => {
    // 4800×1600 → width ratio = 0.5, height ratio = 0.5 → ratio = 0.5
    const { width, height } = calculateDimensions(4800, 1600);
    expect(width).toBe(2400);
    expect(height).toBe(800);
  });

  it("handles exact max dimensions without scaling", () => {
    expect(calculateDimensions(2400, 800)).toEqual({ width: 2400, height: 800 });
  });

  it("preserves aspect ratio when width is the binding constraint", () => {
    // 4800×200 → width ratio = 0.5, height ratio = 4 → ratio = 0.5
    const { width, height } = calculateDimensions(4800, 200);
    expect(width).toBe(2400);
    expect(height).toBe(100);
  });
});

describe("quality ladder", () => {
  it("starts above 0.8 and steps down monotonically", () => {
    for (let i = 1; i < QUALITY_LADDER.length; i++) {
      expect(QUALITY_LADDER[i]).toBeLessThan(QUALITY_LADDER[i - 1]!);
    }
  });

  it("bottoms out above 0 so output is always valid JPEG", () => {
    expect(QUALITY_LADDER.at(-1)).toBeGreaterThan(0);
  });
});

describe("MAX_FILE_BYTES", () => {
  it("matches the 5 MB storage bucket limit", () => {
    expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
  });
});
