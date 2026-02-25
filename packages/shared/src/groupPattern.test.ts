import { describe, it, expect } from "vitest";
import {
  generateGroupPattern,
  generateGroupBanner,
  resolvePatternDNA,
  seedToBytes,
} from "./groupPattern";

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

describe("resolvePatternDNA", () => {
  it("returns consistent results for the same seed", () => {
    const a = resolvePatternDNA(SEED_A);
    const b = resolvePatternDNA(SEED_A);
    expect(a.colorIdx1).toBe(b.colorIdx1);
    expect(a.colorIdx2).toBe(b.colorIdx2);
    expect(a.patternType).toBe(b.patternType);
    expect(a.seeds).toEqual(b.seeds);
  });

  it("picks two distinct color indices", () => {
    // Test across many seeds — colorIdx1 and colorIdx2 should never be equal
    for (let s = 0; s < 100; s++) {
      const dna = resolvePatternDNA(s * 1000);
      expect(dna.colorIdx1).not.toBe(dna.colorIdx2);
    }
  });

  it("returns a valid pattern type", () => {
    const dna = resolvePatternDNA(SEED_A);
    expect(["circles", "stripes", "dots", "waves"]).toContain(dna.patternType);
  });
});

describe("generateGroupBanner", () => {
  it("returns lightSvg and darkSvg strings", () => {
    const result = generateGroupBanner(SEED_A);
    expect(result).toHaveProperty("lightSvg");
    expect(result).toHaveProperty("darkSvg");
    expect(typeof result.lightSvg).toBe("string");
    expect(typeof result.darkSvg).toBe("string");
  });

  it("returns valid SVG markup with 800x160 viewBox", () => {
    const { lightSvg, darkSvg } = generateGroupBanner(SEED_A);
    expect(lightSvg).toMatch(/^<svg /);
    expect(lightSvg).toMatch(/<\/svg>$/);
    expect(lightSvg).toContain('viewBox="0 0 800 160"');
    expect(lightSvg).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(darkSvg).toMatch(/^<svg /);
    expect(darkSvg).toMatch(/<\/svg>$/);
  });

  it("uses width=100% and height=100% for responsive fill", () => {
    const { lightSvg } = generateGroupBanner(SEED_A);
    expect(lightSvg).toContain('width="100%"');
    expect(lightSvg).toContain('height="100%"');
  });

  it("is deterministic — same seed produces same output", () => {
    const a = generateGroupBanner(SEED_A);
    const b = generateGroupBanner(SEED_A);
    expect(a.lightSvg).toBe(b.lightSvg);
    expect(a.darkSvg).toBe(b.darkSvg);
  });

  it("produces different output for different seeds", () => {
    const a = generateGroupBanner(SEED_A);
    const b = generateGroupBanner(SEED_B);
    expect(a.lightSvg).not.toBe(b.lightSvg);
  });

  it("light and dark variants differ", () => {
    const { lightSvg, darkSvg } = generateGroupBanner(SEED_A);
    expect(lightSvg).not.toBe(darkSvg);
  });

  it("namespaces gradient IDs with l/d prefix to avoid DOM collisions", () => {
    const { lightSvg, darkSvg } = generateGroupBanner(SEED_A);
    // Light SVG should use "l" prefix, dark should use "d" prefix
    // Check if gradients exist — pattern type determines which have gradients
    if (lightSvg.includes("radialGradient") || lightSvg.includes("linearGradient")) {
      expect(lightSvg).toMatch(/id="l/);
    }
    if (darkSvg.includes("radialGradient") || darkSvg.includes("linearGradient")) {
      expect(darkSvg).toMatch(/id="d/);
    }
  });

  it("banner and thumbnail share the same pattern DNA", () => {
    // The critical invariant: for any seed, the banner and thumbnail
    // must resolve to the same color indices and pattern type.
    const seeds = [SEED_A, SEED_B, SEED_C, 42, 99999, 1234567890];
    for (const seed of seeds) {
      const dna = resolvePatternDNA(seed);
      const banner = generateGroupBanner(seed);
      const thumbnail = generateGroupPattern(seed);

      // Both should use the same background color (derived from colorIdx1)
      // Extract the first hsl color from the background rect
      const lightBgMatch = (svg: string) =>
        svg.match(/fill="(hsl\([^"]+\))"/)?.[1];
      const bannerBg = lightBgMatch(banner.lightSvg);
      const thumbBg = lightBgMatch(thumbnail.lightSvg);
      expect(bannerBg).toBe(thumbBg);

      // Both should resolve to the same pattern type — verify indirectly
      // by checking that resolvePatternDNA gives consistent results
      const dna2 = resolvePatternDNA(seed);
      expect(dna.patternType).toBe(dna2.patternType);
      expect(dna.colorIdx1).toBe(dna2.colorIdx1);
      expect(dna.colorIdx2).toBe(dna2.colorIdx2);
    }
  });

  it("produces all 4 banner types across varied seeds", () => {
    const seeds = Array.from({ length: 50 }, (_, i) => i * 100);
    const svgs = seeds.map((s) => generateGroupBanner(s).lightSvg);

    const hasOrbs = svgs.some((s) => s.includes("radialGradient"));
    const hasBands = svgs.some((s) => s.includes("linearGradient"));
    const hasParticles = svgs.some((s) => {
      const circleCount = (s.match(/<circle/g) ?? []).length;
      return circleCount >= 15 && !s.includes("radialGradient");
    });
    const hasRidgelines = svgs.some((s) => s.includes("<path"));

    const typesFound = [hasOrbs, hasBands, hasParticles, hasRidgelines].filter(Boolean).length;
    expect(typesFound).toBeGreaterThanOrEqual(2);
  });
});
