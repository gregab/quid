import { describe, it, expect } from "vitest";
import { splitAmount } from "./splitAmount";

describe("splitAmount", () => {
  // --- Basic behavior ---

  it("splits evenly when divisible", () => {
    expect(splitAmount(300, 3)).toEqual([100, 100, 100]);
  });

  it("distributes remainder to first participants", () => {
    // 100 / 3 = 33 remainder 1 → [34, 33, 33]
    expect(splitAmount(100, 3)).toEqual([34, 33, 33]);
  });

  it("handles remainder of 2", () => {
    // 101 / 3 = 33 remainder 2 → [34, 34, 33]
    expect(splitAmount(101, 3)).toEqual([34, 34, 33]);
  });

  it("single participant gets the full amount", () => {
    expect(splitAmount(500, 1)).toEqual([500]);
  });

  it("zero amount splits to all zeros", () => {
    expect(splitAmount(0, 3)).toEqual([0, 0, 0]);
  });

  it("1 cent among many people", () => {
    const result = splitAmount(1, 5);
    expect(result).toEqual([1, 0, 0, 0, 0]);
  });

  // --- Sum invariant (the most critical property) ---

  it("splits always sum to the original amount", () => {
    const cases = [
      [100, 3],
      [101, 3],
      [1, 7],
      [0, 5],
      [999, 4],
      [10000, 7],
      [1, 1],
      [7, 2],
      [99999, 13],
    ] as const;

    for (const [amount, n] of cases) {
      const splits = splitAmount(amount, n);
      const sum = splits.reduce((a, b) => a + b, 0);
      expect(sum).toBe(amount);
    }
  });

  it("splits differ by at most 1 cent", () => {
    const cases = [100, 101, 102, 1, 0, 999, 10000, 7, 99999];
    const participants = [2, 3, 4, 5, 7, 10, 13];

    for (const amount of cases) {
      for (const n of participants) {
        const splits = splitAmount(amount, n);
        const min = Math.min(...splits);
        const max = Math.max(...splits);
        expect(max - min).toBeLessThanOrEqual(1);
      }
    }
  });

  // --- Stress: randomized property tests ---

  it("sum invariant holds for 1000 random inputs", () => {
    for (let i = 0; i < 1000; i++) {
      const amount = Math.floor(Math.random() * 1_000_000);
      const n = Math.floor(Math.random() * 50) + 1;
      const splits = splitAmount(amount, n);

      expect(splits).toHaveLength(n);

      const sum = splits.reduce((a, b) => a + b, 0);
      expect(sum).toBe(amount);

      const min = Math.min(...splits);
      const max = Math.max(...splits);
      expect(max - min).toBeLessThanOrEqual(1);

      for (const s of splits) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(s)).toBe(true);
      }
    }
  });

  // --- Large values ---

  it("handles large amounts without precision loss", () => {
    // $100,000.00 in cents
    const splits = splitAmount(10_000_000, 3);
    expect(splits.reduce((a, b) => a + b, 0)).toBe(10_000_000);
    expect(splits).toEqual([3_333_334, 3_333_333, 3_333_333]);
  });

  it("handles large participant counts", () => {
    const splits = splitAmount(100, 99);
    expect(splits).toHaveLength(99);
    expect(splits.reduce((a, b) => a + b, 0)).toBe(100);
    // First participant gets 2, next 98 get 1 each... wait: 100/99 = 1 remainder 1
    expect(splits[0]).toBe(2);
    expect(splits.slice(1).every((s) => s === 1)).toBe(true);
  });

  it("handles more participants than cents", () => {
    const splits = splitAmount(3, 10);
    expect(splits).toHaveLength(10);
    expect(splits.reduce((a, b) => a + b, 0)).toBe(3);
    // First 3 get 1, rest get 0
    expect(splits.filter((s) => s === 1)).toHaveLength(3);
    expect(splits.filter((s) => s === 0)).toHaveLength(7);
  });

  // --- Error cases ---

  it("throws for zero participants", () => {
    expect(() => splitAmount(100, 0)).toThrow("Cannot split among zero or fewer");
  });

  it("throws for negative participants", () => {
    expect(() => splitAmount(100, -1)).toThrow("Cannot split among zero or fewer");
  });

  it("throws for negative amount", () => {
    expect(() => splitAmount(-100, 3)).toThrow("Amount must be non-negative");
  });

  it("throws for non-integer amount", () => {
    expect(() => splitAmount(10.5, 3)).toThrow("Amount must be an integer");
  });

  it("throws for non-integer participants", () => {
    expect(() => splitAmount(100, 2.5)).toThrow("Participant count must be an integer");
  });
});
