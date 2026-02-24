/**
 * Deterministic SVG pattern generator for group thumbnails.
 * Generates unique, warm-toned patterns seeded from group UUIDs.
 */

// 12 warm nature-palette colors (hue, saturation%, lightness%)
const PALETTE_LIGHT = [
  { h: 35, s: 85, l: 52 },   // honeycomb amber
  { h: 174, s: 55, l: 42 },  // teal tanager
  { h: 265, s: 45, l: 55 },  // iris
  { h: 345, s: 60, l: 55 },  // rosefinch
  { h: 210, s: 55, l: 50 },  // jay blue
  { h: 145, s: 45, l: 40 },  // forest warbler
  { h: 15, s: 65, l: 55 },   // terracotta
  { h: 290, s: 40, l: 50 },  // plum starling
  { h: 195, s: 65, l: 45 },  // kingfisher
  { h: 42, s: 70, l: 50 },   // ochre oriole
  { h: 230, s: 50, l: 48 },  // indigo bunting
  { h: 0, s: 65, l: 50 },    // cardinal
];

const PALETTE_DARK = [
  { h: 35, s: 75, l: 65 },
  { h: 174, s: 45, l: 55 },
  { h: 265, s: 40, l: 68 },
  { h: 345, s: 50, l: 65 },
  { h: 210, s: 45, l: 62 },
  { h: 145, s: 40, l: 55 },
  { h: 15, s: 55, l: 65 },
  { h: 290, s: 35, l: 62 },
  { h: 195, s: 55, l: 58 },
  { h: 42, s: 60, l: 62 },
  { h: 230, s: 42, l: 60 },
  { h: 0, s: 55, l: 62 },
];

function hsl(c: { h: number; s: number; l: number }): string {
  return `hsl(${c.h} ${c.s}% ${c.l}%)`;
}

/** Parse UUID hex digits into seed bytes (0-255). */
export function parseSeeds(groupId: string): number[] {
  const hex = groupId.replace(/-/g, "");
  const seeds: number[] = [];
  for (let i = 0; i < hex.length - 1; i += 2) {
    seeds.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return seeds;
}

type PatternType = "circles" | "stripes" | "dots" | "waves";

const PATTERN_TYPES: PatternType[] = ["circles", "stripes", "dots", "waves"];

function renderCircles(
  seeds: number[],
  size: number,
  fg: string,
  bg: string,
  accent: string,
): string {
  const cx = (seeds[4]! / 255) * size * 0.4 + size * 0.3;
  const cy = (seeds[5]! / 255) * size * 0.4 + size * 0.3;
  const rings = 3 + (seeds[6]! % 3); // 3-5 rings
  const maxR = size * 0.45;

  let circles = "";
  for (let i = rings; i >= 1; i--) {
    const r = (i / rings) * maxR;
    const color = i % 2 === 0 ? accent : fg;
    const opacity = 0.15 + (i / rings) * 0.25;
    circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${opacity.toFixed(2)}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${circles}</svg>`;
}

function renderStripes(
  seeds: number[],
  size: number,
  fg: string,
  bg: string,
  accent: string,
): string {
  const angle = (seeds[4]! / 255) * 60 + 15; // 15-75 degrees
  const count = 4 + (seeds[5]! % 4); // 4-7 stripes
  const stripeW = size / count;

  let stripes = "";
  for (let i = 0; i < count; i++) {
    const color = i % 3 === 0 ? accent : fg;
    const opacity = 0.12 + (seeds[(6 + i) % seeds.length]! / 255) * 0.22;
    const x = i * stripeW;
    stripes += `<rect x="${x.toFixed(1)}" y="-${size * 0.5}" width="${stripeW.toFixed(1)}" height="${size * 2}" fill="${color}" fill-opacity="${opacity.toFixed(2)}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/><g transform="rotate(${angle.toFixed(1)} ${size / 2} ${size / 2})">${stripes}</g></svg>`;
}

function renderDots(
  seeds: number[],
  size: number,
  fg: string,
  bg: string,
  accent: string,
): string {
  const count = 6 + (seeds[4]! % 6); // 6-11 dots
  let dots = "";

  for (let i = 0; i < count; i++) {
    const si = (5 + i * 2) % seeds.length;
    const si2 = (6 + i * 2) % seeds.length;
    const cx = (seeds[si]! / 255) * size * 0.8 + size * 0.1;
    const cy = (seeds[si2]! / 255) * size * 0.8 + size * 0.1;
    const r = 1.5 + (seeds[(7 + i) % seeds.length]! / 255) * (size * 0.1);
    const color = i % 3 === 0 ? accent : fg;
    const opacity = 0.15 + (seeds[(8 + i) % seeds.length]! / 255) * 0.25;
    dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${opacity.toFixed(2)}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${dots}</svg>`;
}

function renderWaves(
  seeds: number[],
  size: number,
  fg: string,
  bg: string,
  accent: string,
): string {
  const waveCount = 3 + (seeds[4]! % 3); // 3-5 waves
  const amplitude = size * 0.08 + (seeds[5]! / 255) * size * 0.12;
  let waves = "";

  for (let i = 0; i < waveCount; i++) {
    const yBase = ((i + 1) / (waveCount + 1)) * size;
    const freq = 1.5 + (seeds[(6 + i) % seeds.length]! / 255) * 1.5;
    const phase = (seeds[(7 + i) % seeds.length]! / 255) * Math.PI * 2;
    const color = i % 2 === 0 ? fg : accent;
    const opacity = 0.15 + (i / waveCount) * 0.2;
    const strokeW = 1.5 + (seeds[(8 + i) % seeds.length]! / 255) * 2;

    // Build a smooth wave path
    const points: string[] = [];
    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * size;
      const y = yBase + Math.sin((s / steps) * Math.PI * 2 * freq + phase) * amplitude;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    waves += `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${strokeW.toFixed(1)}" stroke-linecap="round" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${waves}</svg>`;
}

export function generateGroupPattern(
  groupId: string,
  size = 44,
): { lightSvg: string; darkSvg: string } {
  const seeds = parseSeeds(groupId);
  if (seeds.length < 10) {
    // Fallback for invalid/short IDs
    const fb = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="hsl(35 85% 52%)"/></svg>`;
    return { lightSvg: fb, darkSvg: fb };
  }

  // Pick two distinct colors
  const colorIdx1 = seeds[0]! % PALETTE_LIGHT.length;
  let colorIdx2 = seeds[1]! % (PALETTE_LIGHT.length - 1);
  if (colorIdx2 >= colorIdx1) colorIdx2++;

  const patternType = PATTERN_TYPES[seeds[2]! % PATTERN_TYPES.length]!;

  const lightBg = `hsl(${PALETTE_LIGHT[colorIdx1]!.h} ${Math.round(PALETTE_LIGHT[colorIdx1]!.s * 0.25)}% 95%)`;
  const darkBg = `hsl(${PALETTE_DARK[colorIdx1]!.h} ${Math.round(PALETTE_DARK[colorIdx1]!.s * 0.3)}% 15%)`;

  const render = {
    circles: renderCircles,
    stripes: renderStripes,
    dots: renderDots,
    waves: renderWaves,
  }[patternType];

  const lightSvg = render(
    seeds,
    size,
    hsl(PALETTE_LIGHT[colorIdx1]!),
    lightBg,
    hsl(PALETTE_LIGHT[colorIdx2]!),
  );

  const darkSvg = render(
    seeds,
    size,
    hsl(PALETTE_DARK[colorIdx1]!),
    darkBg,
    hsl(PALETTE_DARK[colorIdx2]!),
  );

  return { lightSvg, darkSvg };
}
