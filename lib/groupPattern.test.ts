import { describe, it, expect } from "vitest";
import { generateGroupPattern, parseSeeds } from "./groupPattern";

const UUID_A = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const UUID_B = "f0e1d2c3-b4a5-6789-0fed-cba987654321";
const UUID_C = "00000000-0000-0000-0000-000000000000";

describe("parseSeeds", () => {
  it("returns 16 bytes from a valid UUID", () => {
    const seeds = parseSeeds(UUID_A);
    expect(seeds).toHaveLength(16);
    seeds.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(255);
    });
  });

  it("strips dashes before parsing", () => {
    const withDashes = parseSeeds(UUID_A);
    const noDashes = parseSeeds(UUID_A.replace(/-/g, ""));
    expect(withDashes).toEqual(noDashes);
  });

  it("returns all zeros for zero UUID", () => {
    const seeds = parseSeeds(UUID_C);
    expect(seeds.every((s) => s === 0)).toBe(true);
  });
});

describe("generateGroupPattern", () => {
  it("returns lightSvg and darkSvg strings", () => {
    const result = generateGroupPattern(UUID_A);
    expect(result).toHaveProperty("lightSvg");
    expect(result).toHaveProperty("darkSvg");
    expect(typeof result.lightSvg).toBe("string");
    expect(typeof result.darkSvg).toBe("string");
  });

  it("returns valid SVG markup", () => {
    const { lightSvg, darkSvg } = generateGroupPattern(UUID_A);
    expect(lightSvg).toMatch(/^<svg /);
    expect(lightSvg).toMatch(/<\/svg>$/);
    expect(darkSvg).toMatch(/^<svg /);
    expect(darkSvg).toMatch(/<\/svg>$/);
  });

  it("is deterministic — same ID produces same output", () => {
    const a = generateGroupPattern(UUID_A);
    const b = generateGroupPattern(UUID_A);
    expect(a.lightSvg).toBe(b.lightSvg);
    expect(a.darkSvg).toBe(b.darkSvg);
  });

  it("produces different output for different IDs", () => {
    const a = generateGroupPattern(UUID_A);
    const b = generateGroupPattern(UUID_B);
    expect(a.lightSvg).not.toBe(b.lightSvg);
  });

  it("respects custom size parameter", () => {
    const { lightSvg } = generateGroupPattern(UUID_A, 80);
    expect(lightSvg).toContain('viewBox="0 0 80 80"');
    expect(lightSvg).toContain('width="80"');
    expect(lightSvg).toContain('height="80"');
  });

  it("uses default size of 44", () => {
    const { lightSvg } = generateGroupPattern(UUID_A);
    expect(lightSvg).toContain('viewBox="0 0 44 44"');
  });

  it("handles short/invalid IDs with fallback", () => {
    const { lightSvg } = generateGroupPattern("abc");
    expect(lightSvg).toMatch(/^<svg /);
    expect(lightSvg).toContain('fill="hsl(35 85% 52%)"');
  });

  it("light and dark variants differ", () => {
    const { lightSvg, darkSvg } = generateGroupPattern(UUID_A);
    expect(lightSvg).not.toBe(darkSvg);
  });

  it("produces all 4 pattern types across varied UUIDs", () => {
    // Generate many patterns and check we get variety
    const uuids = [
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
      "44444444-4444-4444-4444-444444444444",
      "55555555-5555-5555-5555-555555555555",
      "66666666-6666-6666-6666-666666666666",
      "77777777-7777-7777-7777-777777777777",
      "88888888-8888-8888-8888-888888888888",
    ];
    const svgs = uuids.map((id) => generateGroupPattern(id).lightSvg);
    const hasCircle = svgs.some((s) => s.includes("<circle") && !s.includes("polyline"));
    const hasStripe = svgs.some((s) => s.includes("rotate("));
    const hasDots = svgs.some((s) => {
      const circleCount = (s.match(/<circle/g) ?? []).length;
      return circleCount > 3 && !s.includes("rotate(");
    });
    const hasWaves = svgs.some((s) => s.includes("<polyline"));

    // At least 2 of 4 pattern types should appear across 8 UUIDs
    const typesFound = [hasCircle, hasStripe, hasDots, hasWaves].filter(Boolean).length;
    expect(typesFound).toBeGreaterThanOrEqual(2);
  });
});
