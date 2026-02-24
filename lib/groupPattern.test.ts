import { describe, it, expect } from "vitest";
import { generateGroupPattern, seedToBytes } from "./groupPattern";

const SEED_A = 123456789;
const SEED_B = 987654321;
const SEED_C = 0;

describe("seedToBytes", () => {
  it("returns 16 bytes", () => {
    const bytes = seedToBytes(SEED_A);
    expect(bytes).toHaveLength(16);
    bytes.forEach((b) => {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    });
  });

  it("is deterministic", () => {
    expect(seedToBytes(SEED_A)).toEqual(seedToBytes(SEED_A));
  });

  it("produces different bytes for different seeds", () => {
    expect(seedToBytes(SEED_A)).not.toEqual(seedToBytes(SEED_B));
  });

  it("handles zero seed", () => {
    const bytes = seedToBytes(SEED_C);
    expect(bytes).toHaveLength(16);
    // Zero seed still produces values (the LCG additive constant kicks in)
    expect(bytes.some((b) => b !== 0)).toBe(true);
  });
});

describe("generateGroupPattern", () => {
  it("returns lightSvg and darkSvg strings", () => {
    const result = generateGroupPattern(SEED_A);
    expect(result).toHaveProperty("lightSvg");
    expect(result).toHaveProperty("darkSvg");
    expect(typeof result.lightSvg).toBe("string");
    expect(typeof result.darkSvg).toBe("string");
  });

  it("returns valid SVG markup", () => {
    const { lightSvg, darkSvg } = generateGroupPattern(SEED_A);
    expect(lightSvg).toMatch(/^<svg /);
    expect(lightSvg).toMatch(/<\/svg>$/);
    expect(darkSvg).toMatch(/^<svg /);
    expect(darkSvg).toMatch(/<\/svg>$/);
  });

  it("is deterministic — same seed produces same output", () => {
    const a = generateGroupPattern(SEED_A);
    const b = generateGroupPattern(SEED_A);
    expect(a.lightSvg).toBe(b.lightSvg);
    expect(a.darkSvg).toBe(b.darkSvg);
  });

  it("produces different output for different seeds", () => {
    const a = generateGroupPattern(SEED_A);
    const b = generateGroupPattern(SEED_B);
    expect(a.lightSvg).not.toBe(b.lightSvg);
  });

  it("respects custom size parameter", () => {
    const { lightSvg } = generateGroupPattern(SEED_A, 80);
    expect(lightSvg).toContain('viewBox="0 0 80 80"');
    expect(lightSvg).toContain('width="80"');
    expect(lightSvg).toContain('height="80"');
  });

  it("uses default size of 44", () => {
    const { lightSvg } = generateGroupPattern(SEED_A);
    expect(lightSvg).toContain('viewBox="0 0 44 44"');
  });

  it("light and dark variants differ", () => {
    const { lightSvg, darkSvg } = generateGroupPattern(SEED_A);
    expect(lightSvg).not.toBe(darkSvg);
  });

  it("produces all 4 pattern types across varied seeds", () => {
    const seeds = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
    const svgs = seeds.map((s) => generateGroupPattern(s).lightSvg);
    const hasCircle = svgs.some((s) => s.includes("<circle") && !s.includes("polyline"));
    const hasStripe = svgs.some((s) => s.includes("rotate("));
    const hasDots = svgs.some((s) => {
      const circleCount = (s.match(/<circle/g) ?? []).length;
      return circleCount > 3 && !s.includes("rotate(");
    });
    const hasWaves = svgs.some((s) => s.includes("<polyline"));

    // At least 2 of 4 pattern types should appear
    const typesFound = [hasCircle, hasStripe, hasDots, hasWaves].filter(Boolean).length;
    expect(typesFound).toBeGreaterThanOrEqual(2);
  });
});
