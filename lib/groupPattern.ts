/**
 * Deterministic SVG pattern generator for group thumbnails and banners.
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

type HSL = { h: number; s: number; l: number };

function hsl(c: HSL): string {
  return `hsl(${c.h} ${c.s}% ${c.l}%)`;
}

/** Blend two HSL colors at the midpoint, handling hue wrapping. */
function blendHSL(a: HSL, b: HSL): HSL {
  // Shortest-arc hue interpolation
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = ((a.h + dh * 0.5) % 360 + 360) % 360;
  return {
    h: Math.round(h),
    s: Math.round((a.s + b.s) / 2),
    l: Math.round((a.l + b.l) / 2),
  };
}

/** Derive 16 pseudo-random bytes (0-255) from an integer seed. */
export function seedToBytes(seed: number): number[] {
  const bytes: number[] = [];
  let v = Math.abs(Math.round(seed));
  for (let i = 0; i < 16; i++) {
    // LCG step — high bits have much better randomness than low bits
    v = ((v * 1103515245 + 12345) >>> 0) & 0x7fffffff;
    bytes.push((v >>> 16) & 0xff);
  }
  return bytes;
}

type PatternType = "circles" | "stripes" | "dots" | "waves";

const PATTERN_TYPES: PatternType[] = ["circles", "stripes", "dots", "waves"];

/** Shared identity extraction — guarantees thumbnail + banner use the same colors and pattern family. */
export function resolvePatternDNA(seed: number): {
  seeds: number[];
  colorIdx1: number;
  colorIdx2: number;
  patternType: PatternType;
} {
  const seeds = seedToBytes(seed);
  const colorIdx1 = seeds[0]! % PALETTE_LIGHT.length;
  let colorIdx2 = seeds[1]! % (PALETTE_LIGHT.length - 1);
  if (colorIdx2 >= colorIdx1) colorIdx2++;
  const patternType = PATTERN_TYPES[seeds[2]! % PATTERN_TYPES.length]!;
  return { seeds, colorIdx1, colorIdx2, patternType };
}

// ─── Thumbnail renderers ───────────────────────────────────────────────

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

// ─── Banner renderers (800×160 viewBox) ────────────────────────────────

const BW = 800;
const BH = 160;

/** Orbs/Bokeh — large overlapping radial-gradient circles + solid accents. Maps from "circles" thumbnail. */
function renderBannerOrbs(
  seeds: number[],
  fg: string,
  bg: string,
  accent: string,
  mid: string,
  prefix: string,
): string {
  const count = 5 + (seeds[4]! % 5); // 5-9 orbs
  let defs = "";
  let circles = "";

  for (let i = 0; i < count; i++) {
    const si = (4 + i) % seeds.length;
    const si2 = (5 + i) % seeds.length;
    const si3 = (6 + i) % seeds.length;
    const cx = (seeds[si]! / 255) * BW;
    const cy = (seeds[si2]! / 255) * BH;

    // Layer sizes: large background washes → medium → small bright highlights
    let r: number;
    let innerOpacity: number;
    let outerOpacity: number;
    if (i < 3) {
      r = 60 + (seeds[si3]! / 255) * 80; // 60-140
      innerOpacity = 0.25 + (seeds[si]! / 255) * 0.15;
      outerOpacity = 0.05;
    } else if (i < 6) {
      r = 30 + (seeds[si3]! / 255) * 50; // 30-80
      innerOpacity = 0.35 + (seeds[si]! / 255) * 0.15;
      outerOpacity = 0.08;
    } else {
      r = 10 + (seeds[si3]! / 255) * 25; // 10-35
      innerOpacity = 0.45 + (seeds[si]! / 255) * 0.2;
      outerOpacity = 0.1;
    }

    const colors = [fg, accent, mid];
    const color = colors[i % 3]!;
    const gradId = `${prefix}og${i}`;

    defs += `<radialGradient id="${gradId}"><stop offset="0%" stop-color="${color}" stop-opacity="${innerOpacity.toFixed(2)}"/><stop offset="100%" stop-color="${color}" stop-opacity="${outerOpacity.toFixed(2)}"/></radialGradient>`;
    circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#${gradId})" />`;
  }

  // Solid accent dots for visual crispness
  let accents = "";
  const accentCount = 3 + (seeds[3]! % 3); // 3-5 small solid dots
  for (let i = 0; i < accentCount; i++) {
    const si = (10 + i) % seeds.length;
    const si2 = (11 + i) % seeds.length;
    const cx = (seeds[si]! / 255) * BW * 0.9 + BW * 0.05;
    const cy = (seeds[si2]! / 255) * BH * 0.8 + BH * 0.1;
    const r = 3 + (seeds[(12 + i) % seeds.length]! / 255) * 6; // 3-9
    const colors = [fg, accent, mid];
    const color = colors[i % 3]!;
    accents += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="0.4" />`;
  }

  return `<defs>${defs}</defs><rect width="${BW}" height="${BH}" fill="${bg}"/>${circles}${accents}`;
}

/** Gradient Bands — diagonal bands with soft linear gradients + solid accent lines. Maps from "stripes" thumbnail. */
function renderBannerBands(
  seeds: number[],
  fg: string,
  bg: string,
  accent: string,
  mid: string,
  prefix: string,
): string {
  const count = 4 + (seeds[4]! % 4); // 4-7 bands
  const angle = 10 + (seeds[5]! / 255) * 20; // 10-30 degrees
  let defs = "";
  let bands = "";

  for (let i = 0; i < count; i++) {
    const si = (6 + i) % seeds.length;
    const colors = [fg, accent, mid];
    const color = colors[i % 3]!;
    const opacity = 0.2 + (seeds[si]! / 255) * 0.2;
    const bandW = BW / count + (seeds[(7 + i) % seeds.length]! / 255) * 40 - 20;
    const x = (i / count) * BW;
    const gradId = `${prefix}bg${i}`;

    defs += `<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${color}" stop-opacity="${(opacity * 0.3).toFixed(2)}"/><stop offset="30%" stop-color="${color}" stop-opacity="${opacity.toFixed(2)}"/><stop offset="70%" stop-color="${color}" stop-opacity="${(opacity * 0.8).toFixed(2)}"/><stop offset="100%" stop-color="${color}" stop-opacity="${(opacity * 0.15).toFixed(2)}"/></linearGradient>`;
    bands += `<rect x="${x.toFixed(1)}" y="${-BH * 0.5}" width="${bandW.toFixed(1)}" height="${BH * 2}" fill="url(#${gradId})" />`;
  }

  // Thin solid accent lines along band edges for definition
  let lines = "";
  const lineCount = 2 + (seeds[3]! % 3); // 2-4 lines
  for (let i = 0; i < lineCount; i++) {
    const x = ((i + 1) / (lineCount + 1)) * BW;
    const colors = [fg, accent, mid];
    const color = colors[i % 3]!;
    lines += `<line x1="${x.toFixed(1)}" y1="${-BH * 0.5}" x2="${x.toFixed(1)}" y2="${BH * 2}" stroke="${color}" stroke-opacity="0.2" stroke-width="1.5" />`;
  }

  return `<defs>${defs}</defs><rect width="${BW}" height="${BH}" fill="${bg}"/><g transform="rotate(${angle.toFixed(1)} ${BW / 2} ${BH / 2})">${bands}${lines}</g>`;
}

/** Particle Field — scattered circles at varying sizes. Maps from "dots" thumbnail. */
function renderBannerParticles(
  seeds: number[],
  fg: string,
  bg: string,
  accent: string,
  mid: string,
  _prefix: string,
): string {
  const count = 15 + (seeds[4]! % 11); // 15-25 particles
  let particles = "";

  for (let i = 0; i < count; i++) {
    const si = (5 + i * 2) % seeds.length;
    const si2 = (6 + i * 2) % seeds.length;
    const si3 = (7 + i) % seeds.length;
    const cx = (seeds[si]! / 255) * BW * 0.95 + BW * 0.025;
    const cy = (seeds[si2]! / 255) * BH * 0.9 + BH * 0.05;

    // Size tiers: mostly tiny, some medium, a few large accents
    let r: number;
    if (i < 8) {
      r = 1 + (seeds[si3]! / 255) * 2; // tiny 1-3
    } else if (i < 18) {
      r = 4 + (seeds[si3]! / 255) * 6; // medium 4-10
    } else {
      r = 15 + (seeds[si3]! / 255) * 10; // large 15-25
    }

    const colors = [fg, accent, mid];
    const color = colors[i % 3]!;
    const opacity = 0.25 + (seeds[(8 + i) % seeds.length]! / 255) * 0.35;
    particles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${opacity.toFixed(2)}" />`;
  }

  return `<rect width="${BW}" height="${BH}" fill="${bg}"/>${particles}`;
}

/** Ridgelines — filled wave paths stacked back-to-front. Maps from "waves" thumbnail. */
function renderBannerRidgelines(
  seeds: number[],
  fg: string,
  bg: string,
  accent: string,
  mid: string,
  _prefix: string,
): string {
  const count = 3 + (seeds[4]! % 3); // 3-5 ridgelines
  let ridgelines = "";

  for (let i = 0; i < count; i++) {
    const si = (6 + i) % seeds.length;
    const si2 = (7 + i) % seeds.length;
    const yBase = BH * 0.35 + ((i + 1) / (count + 1)) * BH * 0.55;
    const amplitude = 15 + (seeds[si]! / 255) * 25;
    const freq = 1 + (seeds[si2]! / 255) * 2;
    const phase = (seeds[(8 + i) % seeds.length]! / 255) * Math.PI * 2;

    const colors = [fg, mid, accent];
    const color = colors[i % 3]!;
    const opacity = 0.2 + (i / count) * 0.3;

    // Build smooth curve across the width
    const steps = 40;
    let d = `M0,${BH}`;
    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * BW;
      const y = yBase + Math.sin((s / steps) * Math.PI * 2 * freq + phase) * amplitude;
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    d += ` L${BW},${BH} Z`;

    ridgelines += `<path d="${d}" fill="${color}" fill-opacity="${opacity.toFixed(2)}" />`;
  }

  return `<rect width="${BW}" height="${BH}" fill="${bg}"/>${ridgelines}`;
}

// ─── Public API ────────────────────────────────────────────────────────

export function generateGroupPattern(
  seed: number,
  size = 44,
): { lightSvg: string; darkSvg: string } {
  const { seeds, colorIdx1, colorIdx2, patternType } = resolvePatternDNA(seed);

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

export function generateGroupBanner(
  seed: number,
): { lightSvg: string; darkSvg: string } {
  const { seeds, colorIdx1, colorIdx2, patternType } = resolvePatternDNA(seed);

  const lightC1 = PALETTE_LIGHT[colorIdx1]!;
  const lightC2 = PALETTE_LIGHT[colorIdx2]!;
  const darkC1 = PALETTE_DARK[colorIdx1]!;
  const darkC2 = PALETTE_DARK[colorIdx2]!;

  const lightBg = `hsl(${lightC1.h} ${Math.round(lightC1.s * 0.25)}% 95%)`;
  const darkBg = `hsl(${darkC1.h} ${Math.round(darkC1.s * 0.3)}% 15%)`;

  const lightMid = blendHSL(lightC1, lightC2);
  const darkMid = blendHSL(darkC1, darkC2);

  const bannerRenderer = {
    circles: renderBannerOrbs,
    stripes: renderBannerBands,
    dots: renderBannerParticles,
    waves: renderBannerRidgelines,
  }[patternType];

  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;

  const lightSvg = wrap(
    bannerRenderer(seeds, hsl(lightC1), lightBg, hsl(lightC2), hsl(lightMid), "l"),
  );

  const darkSvg = wrap(
    bannerRenderer(seeds, hsl(darkC1), darkBg, hsl(darkC2), hsl(darkMid), "d"),
  );

  return { lightSvg, darkSvg };
}
