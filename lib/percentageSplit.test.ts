import { describe, it, expect } from "vitest";
import { percentagesToCents, centsToPercentages } from "./percentageSplit";

describe("percentagesToCents", () => {
  it("splits evenly with no remainder", () => {
    const pcts = new Map([["a", "50.00"], ["b", "50.00"]]);
    const result = percentagesToCents(pcts, ["a", "b"], 200);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(100);
  });

  it("distributes remainder pennies to first participants", () => {
    // 100 cents / 3 = 33.33... → floor is 33 each, remainder = 1
    const pcts = new Map([
      ["a", (100 / 3).toFixed(2)],
      ["b", (100 / 3).toFixed(2)],
      ["c", (100 / 3).toFixed(2)],
    ]);
    const result = percentagesToCents(pcts, ["a", "b", "c"], 100);
    expect(result.get("a")).toBe(34); // gets the extra penny
    expect(result.get("b")).toBe(33);
    expect(result.get("c")).toBe(33);
    const total = (result.get("a") ?? 0) + (result.get("b") ?? 0) + (result.get("c") ?? 0);
    expect(total).toBe(100);
  });

  it("handles unequal percentages with remainder", () => {
    // 70/30 on $1.00 = 70 and 30 exactly
    const pcts = new Map([["a", "70.00"], ["b", "30.00"]]);
    const result = percentagesToCents(pcts, ["a", "b"], 100);
    expect(result.get("a")).toBe(70);
    expect(result.get("b")).toBe(30);
    expect((result.get("a") ?? 0) + (result.get("b") ?? 0)).toBe(100);
  });

  it("always sums exactly to totalCents", () => {
    // $10.00 split 3 ways at 33.33/33.33/33.34
    const pcts = new Map([["a", "33.33"], ["b", "33.33"], ["c", "33.34"]]);
    const result = percentagesToCents(pcts, ["a", "b", "c"], 1000);
    const total = [...result.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(1000);
  });

  it("returns zeros when totalCents is 0", () => {
    const pcts = new Map([["a", "50.00"], ["b", "50.00"]]);
    const result = percentagesToCents(pcts, ["a", "b"], 0);
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(0);
  });

  it("returns zeros for empty participant list", () => {
    const pcts = new Map<string, string>();
    const result = percentagesToCents(pcts, [], 100);
    expect(result.size).toBe(0);
  });

  it("handles missing percentage entry as 0", () => {
    // "b" has no entry in percentages map
    const pcts = new Map([["a", "100.00"]]);
    const result = percentagesToCents(pcts, ["a", "b"], 200);
    expect(result.get("a")).toBe(200);
    expect(result.get("b")).toBe(0);
  });
});

describe("centsToPercentages", () => {
  it("derives correct percentages from dollar amounts", () => {
    const amounts = new Map([["a", "10.00"], ["b", "10.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 2000);
    expect(result.get("a")).toBe("50.00");
    expect(result.get("b")).toBe("50.00");
  });

  it("handles unequal splits", () => {
    const amounts = new Map([["a", "7.00"], ["b", "3.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 1000);
    expect(result.get("a")).toBe("70.00");
    expect(result.get("b")).toBe("30.00");
  });

  it("returns 0.00 for all when totalCents is 0", () => {
    const amounts = new Map([["a", "0.00"], ["b", "0.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 0);
    expect(result.get("a")).toBe("0.00");
    expect(result.get("b")).toBe("0.00");
  });

  it("handles missing amount entry as 0", () => {
    const amounts = new Map([["a", "10.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 1000);
    expect(result.get("a")).toBe("100.00");
    expect(result.get("b")).toBe("0.00");
  });
});

describe("round-trip: percentagesToCents → centsToPercentages", () => {
  it("preserves approximate percentages through a round trip", () => {
    const totalCents = 1000;
    const originalPcts = new Map([["a", "33.33"], ["b", "33.33"], ["c", "33.34"]]);
    const cents = percentagesToCents(originalPcts, ["a", "b", "c"], totalCents);
    const centsAsStrings = new Map(
      [...cents.entries()].map(([id, v]) => [id, (v / 100).toFixed(2)])
    );
    const derivedPcts = centsToPercentages(centsAsStrings, ["a", "b", "c"], totalCents);
    // Each derived percentage should be close to original (within rounding)
    for (const id of ["a", "b", "c"]) {
      const orig = parseFloat(originalPcts.get(id) ?? "0");
      const derived = parseFloat(derivedPcts.get(id) ?? "0");
      expect(Math.abs(derived - orig)).toBeLessThan(0.5);
    }
  });
});
