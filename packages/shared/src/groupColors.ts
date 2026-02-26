/**
 * Group identity colors — 12 nature-named hues for distinguishing groups.
 * Used by mobile for GroupThumbnail backgrounds and friend avatars.
 *
 * Hex values derived from the HSL palette in groupPattern.ts to stay consistent.
 */

export interface GroupColor {
  /** Nature-inspired name */
  name: string;
  /** Light mode background (soft tint) */
  bg: string;
  /** Dark mode background (muted deep) */
  darkBg: string;
  /** Bold accent for borders/icons */
  accent: string;
}

export const GROUP_COLORS: GroupColor[] = [
  { name: "honeycomb",       bg: "#fef3c7", darkBg: "#422006", accent: "#d97706" },
  { name: "teal tanager",    bg: "#ccfbf1", darkBg: "#042f2e", accent: "#0d9488" },
  { name: "iris",            bg: "#ede9fe", darkBg: "#1e1b4b", accent: "#7c3aed" },
  { name: "rosefinch",       bg: "#fce7f3", darkBg: "#500724", accent: "#db2777" },
  { name: "jay blue",        bg: "#dbeafe", darkBg: "#172554", accent: "#2563eb" },
  { name: "forest warbler",  bg: "#dcfce7", darkBg: "#052e16", accent: "#16a34a" },
  { name: "terracotta",      bg: "#ffedd5", darkBg: "#431407", accent: "#ea580c" },
  { name: "plum starling",   bg: "#f5d0fe", darkBg: "#3b0764", accent: "#a855f7" },
  { name: "kingfisher",      bg: "#cffafe", darkBg: "#083344", accent: "#0891b2" },
  { name: "ochre oriole",    bg: "#fef9c3", darkBg: "#422006", accent: "#ca8a04" },
  { name: "indigo bunting",  bg: "#e0e7ff", darkBg: "#1e1b4b", accent: "#4f46e5" },
  { name: "cardinal",        bg: "#fee2e2", darkBg: "#450a0a", accent: "#dc2626" },
];

/** Get a group color by index, wrapping around if needed. */
export function getGroupColor(index: number): GroupColor {
  const i = ((index % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length;
  return GROUP_COLORS[i]!;
}
