import { describe, it, expect } from "vitest";
import { percentagesToCents, centsToPercentages } from "./percentageSplit";
import { splitAmount } from "./balances/splitAmount";

describe("percentagesToCents", () => {
  it("splits evenly with no remainder", () => {
    const pcts = new Map([["a", "50"], ["b", "50"]]);
    const result = percentagesToCents(pcts, ["a", "b"], 200);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(100);
  });

  it("distributes remainder pennies to first participants", () => {
    // 100 cents / 3 = 33.33... → floor is 33 each, remainder = 1
    const pcts = new Map([
      ["a", "33"],
      ["b", "33"],
      ["c", "34"],
    ]);
    const result = percentagesToCents(pcts, ["a", "b", "c"], 100);
    expect(result.get("a")).toBe(33);
    expect(result.get("b")).toBe(33);
    expect(result.get("c")).toBe(34);
    const total = (result.get("a") ?? 0) + (result.get("b") ?? 0) + (result.get("c") ?? 0);
    expect(total).toBe(100);
  });

  it("handles unequal percentages with remainder", () => {
    // 70/30 on $1.00 = 70 and 30 exactly
    const pcts = new Map([["a", "70"], ["b", "30"]]);
    const result = percentagesToCents(pcts, ["a", "b"], 100);
    expect(result.get("a")).toBe(70);
    expect(result.get("b")).toBe(30);
    expect((result.get("a") ?? 0) + (result.get("b") ?? 0)).toBe(100);
  });

  it("always sums exactly to totalCents", () => {
    // $10.00 split 3 ways at 33/33/34
    const pcts = new Map([["a", "33"], ["b", "33"], ["c", "34"]]);
    const result = percentagesToCents(pcts, ["a", "b", "c"], 1000);
    const total = [...result.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(1000);
  });

  it("returns zeros when totalCents is 0", () => {
    const pcts = new Map([["a", "50"], ["b", "50"]]);
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
    const pcts = new Map([["a", "100"]]);
    const result = percentagesToCents(pcts, ["a", "b"], 200);
    expect(result.get("a")).toBe(200);
    expect(result.get("b")).toBe(0);
  });
});

describe("centsToPercentages", () => {
  it("derives correct percentages from dollar amounts", () => {
    const amounts = new Map([["a", "10.00"], ["b", "10.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 2000);
    expect(result.get("a")).toBe("50");
    expect(result.get("b")).toBe("50");
  });

  it("handles unequal splits", () => {
    const amounts = new Map([["a", "7.00"], ["b", "3.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 1000);
    expect(result.get("a")).toBe("70");
    expect(result.get("b")).toBe("30");
  });

  it("returns 0 for all when totalCents is 0", () => {
    const amounts = new Map([["a", "0.00"], ["b", "0.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 0);
    expect(result.get("a")).toBe("0");
    expect(result.get("b")).toBe("0");
  });

  it("handles missing amount entry as 0", () => {
    const amounts = new Map([["a", "10.00"]]);
    const result = centsToPercentages(amounts, ["a", "b"], 1000);
    expect(result.get("a")).toBe("100");
    expect(result.get("b")).toBe("0");
  });
});

describe("round-trip: percentagesToCents → centsToPercentages", () => {
  it("preserves approximate percentages through a round trip", () => {
    const totalCents = 1000;
    const originalPcts = new Map([["a", "33"], ["b", "33"], ["c", "34"]]);
    const cents = percentagesToCents(originalPcts, ["a", "b", "c"], totalCents);
    const centsAsStrings = new Map(
      [...cents.entries()].map(([id, v]) => [id, (v / 100).toFixed(2)])
    );
    const derivedPcts = centsToPercentages(centsAsStrings, ["a", "b", "c"], totalCents);
    // Each derived percentage should be close to original (within rounding)
    for (const id of ["a", "b", "c"]) {
      const orig = parseFloat(originalPcts.get(id) ?? "0");
      const derived = parseFloat(derivedPcts.get(id) ?? "0");
      expect(Math.abs(derived - orig)).toBeLessThan(1);
    }
  });
});

/**
 * Tests for the splitCentsRef pattern: a ref holding cent amounts survives
 * lossy round-trips through integer percentages. Both percentage and custom-$
 * views derive from the ref, so switching modes without editing preserves
 * the original precision.
 */
describe("mode-switching with splitCentsRef (equal → % → custom $)", () => {
  /**
   * Simulates the UI mode-switch logic:
   * - splitCentsRef holds the ground-truth cents
   * - Switching to percentage: derive percentages from splitCentsRef
   * - Switching back to custom: derive dollars from splitCentsRef (NOT from percentages)
   */
  function simulateEqualToPercentToCustom(totalCents: number, ids: string[]) {
    // 1. Start in equal mode — compute equal split cents
    const equal = splitAmount(totalCents, ids.length);
    const splitCentsRef = new Map<string, number>();
    ids.forEach((id, i) => splitCentsRef.set(id, equal[i]!));

    // 2. Switch to percentage mode — capture equal cents into ref, derive percentages
    const dollarsMap = new Map<string, string>();
    ids.forEach((id) => dollarsMap.set(id, ((splitCentsRef.get(id) ?? 0) / 100).toFixed(2)));
    const percentages = centsToPercentages(dollarsMap, ids, totalCents);

    // 3. Switch back to custom mode WITHOUT editing percentages
    //    → derive from splitCentsRef (not from percentages)
    const customDollars = new Map<string, string>();
    ids.forEach((id) => customDollars.set(id, ((splitCentsRef.get(id) ?? 0) / 100).toFixed(2)));

    return { equal, splitCentsRef, percentages, customDollars };
  }

  it("$10.00 / 3 people: equal → % → custom preserves 334/333/333", () => {
    const ids = ["a", "b", "c"];
    const totalCents = 1000;
    const { equal, customDollars } = simulateEqualToPercentToCustom(totalCents, ids);

    // Original equal split is 334/333/333
    expect(equal).toEqual([334, 333, 333]);

    // Custom dollars derived from ref should match
    expect(customDollars.get("a")).toBe("3.34");
    expect(customDollars.get("b")).toBe("3.33");
    expect(customDollars.get("c")).toBe("3.33");

    // Verify cents round-trip correctly
    const reconstructedCents = ids.map((id) => Math.round(parseFloat(customDollars.get(id)!) * 100));
    expect(reconstructedCents).toEqual([334, 333, 333]);
    expect(reconstructedCents.reduce((a, b) => a + b, 0)).toBe(totalCents);
  });

  it("$100.00 / 3 people: equal → % → custom preserves 3334/3333/3333", () => {
    const ids = ["a", "b", "c"];
    const totalCents = 10000;
    const { equal, customDollars } = simulateEqualToPercentToCustom(totalCents, ids);

    expect(equal).toEqual([3334, 3333, 3333]);
    expect(customDollars.get("a")).toBe("33.34");
    expect(customDollars.get("b")).toBe("33.33");
    expect(customDollars.get("c")).toBe("33.33");
  });

  it("WITHOUT splitCentsRef, round-trip through percentages is lossy", () => {
    // This test documents the bug that splitCentsRef fixes
    const ids = ["a", "b", "c"];
    const totalCents = 1000;
    const equal = splitAmount(totalCents, ids.length);

    // equal → percentage
    const dollarsMap = new Map<string, string>(
      ids.map((id, i) => [id, (equal[i]! / 100).toFixed(2)])
    );
    const percentages = centsToPercentages(dollarsMap, ids, totalCents);
    // Percentages are 34/33/33 (integer rounding)

    // percentage → custom (deriving from percentages, not ref)
    const centMap = percentagesToCents(percentages, ids, totalCents);
    const lossyDollars = new Map<string, string>();
    ids.forEach((id) => lossyDollars.set(id, ((centMap.get(id) ?? 0) / 100).toFixed(2)));

    // The lossy round-trip gives 340/330/330 — NOT 334/333/333
    expect(Math.round(parseFloat(lossyDollars.get("a")!) * 100)).toBe(340);
    expect(Math.round(parseFloat(lossyDollars.get("b")!) * 100)).toBe(330);
    expect(Math.round(parseFloat(lossyDollars.get("c")!) * 100)).toBe(330);

    // The original was 334/333/333 — different!
    expect(equal).toEqual([334, 333, 333]);
  });

  it("custom → % → custom preserves original custom amounts", () => {
    const ids = ["a", "b", "c"];
    const totalCents = 1000;
    const originalCents = new Map([["a", 500], ["b", 300], ["c", 200]]);

    // Simulate: capture custom cents into ref
    const splitCentsRef = new Map(originalCents);

    // Switch to percentage (derive from ref)
    const dollarsMap = new Map<string, string>();
    ids.forEach((id) => dollarsMap.set(id, ((splitCentsRef.get(id) ?? 0) / 100).toFixed(2)));
    centsToPercentages(dollarsMap, ids, totalCents); // derived but not used

    // Switch back to custom WITHOUT editing — derive from ref
    const customDollars = new Map<string, string>();
    ids.forEach((id) => customDollars.set(id, ((splitCentsRef.get(id) ?? 0) / 100).toFixed(2)));

    expect(Math.round(parseFloat(customDollars.get("a")!) * 100)).toBe(500);
    expect(Math.round(parseFloat(customDollars.get("b")!) * 100)).toBe(300);
    expect(Math.round(parseFloat(customDollars.get("c")!) * 100)).toBe(200);
  });

  it("equal → % → EDIT percentage → custom reflects edited values", () => {
    const ids = ["a", "b", "c"];
    const totalCents = 1000;

    // 1. Start equal
    const equal = splitAmount(totalCents, ids.length);
    const splitCentsRef = new Map<string, number>();
    ids.forEach((id, i) => splitCentsRef.set(id, equal[i]!));

    // 2. Switch to percentage
    const dollarsMap = new Map<string, string>();
    ids.forEach((id) => dollarsMap.set(id, ((splitCentsRef.get(id) ?? 0) / 100).toFixed(2)));
    centsToPercentages(dollarsMap, ids, totalCents);

    // 3. User edits percentages to 50/25/25
    const editedPcts = new Map([["a", "50"], ["b", "25"], ["c", "25"]]);
    // inputDirtyRef = true, so on mode switch we derive from edited percentages
    const editedCents = percentagesToCents(editedPcts, ids, totalCents);

    // 4. Update splitCentsRef with user's edits (simulating dirty flag)
    ids.forEach((id) => splitCentsRef.set(id, editedCents.get(id)!));

    // 5. Switch to custom — derive from updated ref
    const customDollars = new Map<string, string>();
    ids.forEach((id) => customDollars.set(id, ((splitCentsRef.get(id) ?? 0) / 100).toFixed(2)));

    expect(customDollars.get("a")).toBe("5.00");
    expect(customDollars.get("b")).toBe("2.50");
    expect(customDollars.get("c")).toBe("2.50");
  });
});

/**
 * Tests for the "Equal → Percentage" transition pattern used in the UI.
 * With integer percentages, 3-way splits round to 33/33/33 = 99%.
 * The UI will show this as needing adjustment (user must set one to 34%).
 */
describe("equal-split-to-percentages pattern (UI: Equal → % toggle)", () => {
  it("$50 split 3 ways: integer percentages sum to exactly 100 via remainder distribution", () => {
    const ids = ["a", "b", "c"];
    const totalCents = 5000;
    const equalCents = splitAmount(totalCents, ids.length);
    const dollarsMap = new Map(ids.map((id, i) => [id, (equalCents[i]! / 100).toFixed(2)]));
    const pcts = centsToPercentages(dollarsMap, ids, totalCents);
    const sum = ids.reduce((s, id) => s + parseInt(pcts.get(id) ?? "0"), 0);
    expect(sum).toBe(100);
    // Two get 33%, one gets 34% (remainder distributed to largest fractional part)
    const values = ids.map((id) => parseInt(pcts.get(id) ?? "0"));
    expect(values.sort()).toEqual([33, 33, 34]);
  });

  it("$100 split 3 ways: integer percentages sum to exactly 100", () => {
    const ids = ["a", "b", "c"];
    const totalCents = 10000;
    const equalCents = splitAmount(totalCents, ids.length);
    const dollarsMap = new Map(ids.map((id, i) => [id, (equalCents[i]! / 100).toFixed(2)]));
    const pcts = centsToPercentages(dollarsMap, ids, totalCents);
    const sum = ids.reduce((s, id) => s + parseInt(pcts.get(id) ?? "0"), 0);
    expect(sum).toBe(100);
    const values = ids.map((id) => parseInt(pcts.get(id) ?? "0"));
    expect(values.sort()).toEqual([33, 33, 34]);
  });

  it("$10 split 3 ways: 33/33/34 round-trips back to cents correctly", () => {
    const ids = ["a", "b", "c"];
    const totalCents = 1000;
    // User manually sets 33/33/34 to sum to 100
    const pcts = new Map([["a", "33"], ["b", "33"], ["c", "34"]]);
    const roundTripped = percentagesToCents(pcts, ids, totalCents);
    expect(roundTripped.get("a")).toBe(330);
    expect(roundTripped.get("b")).toBe(330);
    expect(roundTripped.get("c")).toBe(340);
    expect([...roundTripped.values()].reduce((s, v) => s + v, 0)).toBe(totalCents);
  });

  it("equal split 2 ways always gives exactly 50/50", () => {
    const ids = ["a", "b"];
    const totalCents = 5000;
    const equalCents = splitAmount(totalCents, ids.length);
    const dollarsMap = new Map(ids.map((id, i) => [id, (equalCents[i]! / 100).toFixed(2)]));
    const pcts = centsToPercentages(dollarsMap, ids, totalCents);
    expect(pcts.get("a")).toBe("50");
    expect(pcts.get("b")).toBe("50");
  });
});
