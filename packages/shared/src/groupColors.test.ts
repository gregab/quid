import { describe, it, expect } from "vitest";
import { getGroupColor, GROUP_COLORS } from "./groupColors";

describe("GROUP_COLORS", () => {
  it("has exactly 12 colors", () => {
    expect(GROUP_COLORS).toHaveLength(12);
  });

  it("each color has required fields", () => {
    for (const c of GROUP_COLORS) {
      expect(c.name).toBeTruthy();
      expect(c.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.darkBg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("getGroupColor", () => {
  it("returns correct color for valid index", () => {
    expect(getGroupColor(0)).toBe(GROUP_COLORS[0]);
    expect(getGroupColor(5)).toBe(GROUP_COLORS[5]);
    expect(getGroupColor(11)).toBe(GROUP_COLORS[11]);
  });

  it("wraps around for index >= 12", () => {
    expect(getGroupColor(12)).toBe(GROUP_COLORS[0]);
    expect(getGroupColor(13)).toBe(GROUP_COLORS[1]);
    expect(getGroupColor(25)).toBe(GROUP_COLORS[1]); // 25 % 12 = 1
  });

  it("handles negative indices by wrapping", () => {
    expect(getGroupColor(-1)).toBe(GROUP_COLORS[11]);
    expect(getGroupColor(-12)).toBe(GROUP_COLORS[0]);
    expect(getGroupColor(-13)).toBe(GROUP_COLORS[11]);
  });

  it("handles zero", () => {
    expect(getGroupColor(0).name).toBe("honeycomb");
  });
});
