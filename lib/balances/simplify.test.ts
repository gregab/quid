import { describe, it, expect } from "vitest";
import { simplifyDebts, type Debt } from "./simplify";

function totalOwed(debts: Debt[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const { from, to, amount } of debts) {
    map.set(from, (map.get(from) ?? 0) - amount);
    map.set(to, (map.get(to) ?? 0) + amount);
  }
  return map;
}

function balancesMatch(original: Debt[], simplified: Debt[]): boolean {
  const orig = totalOwed(original);
  const simp = totalOwed(simplified);
  const allPeople = new Set([...orig.keys(), ...simp.keys()]);
  for (const person of allPeople) {
    const a = Math.round((orig.get(person) ?? 0) * 100);
    const b = Math.round((simp.get(person) ?? 0) * 100);
    if (a !== b) return false;
  }
  return true;
}

describe("simplifyDebts", () => {
  it("handles empty input", () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it("two people, one expense", () => {
    const debts: Debt[] = [{ from: "alice", to: "bob", amount: 50 }];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: "alice", to: "bob", amount: 50 });
    expect(balancesMatch(debts, result)).toBe(true);
  });

  it("three people, alice paid for all", () => {
    // Alice paid 90, Bob owes 30, Carol owes 30, Alice is owed 60
    const debts: Debt[] = [
      { from: "bob", to: "alice", amount: 30 },
      { from: "carol", to: "alice", amount: 30 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(2);
    expect(balancesMatch(debts, result)).toBe(true);
  });

  it("already settled — no debts", () => {
    const result = simplifyDebts([]);
    expect(result).toEqual([]);
  });

  it("zero amount debts are ignored", () => {
    const debts: Debt[] = [
      { from: "alice", to: "bob", amount: 0 },
      { from: "bob", to: "alice", amount: 0 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(0);
  });

  it("circular debts simplify: A->B->C->A each 30", () => {
    // A owes B 30, B owes C 30, C owes A 30
    // Net balances: A=0, B=0, C=0 → no transactions needed
    const debts: Debt[] = [
      { from: "A", to: "B", amount: 30 },
      { from: "B", to: "C", amount: 30 },
      { from: "C", to: "A", amount: 30 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(0);
  });

  it("partial circular: A->B 30, B->C 20, C->A 10", () => {
    // Net: A = -30 + 10 = -20, B = 30 - 20 = 10, C = 20 - 10 = 10
    const debts: Debt[] = [
      { from: "A", to: "B", amount: 30 },
      { from: "B", to: "C", amount: 20 },
      { from: "C", to: "A", amount: 10 },
    ];
    const result = simplifyDebts(debts);
    expect(balancesMatch(debts, result)).toBe(true);
    // Should take fewer transactions than the original 3
    expect(result.length).toBeLessThanOrEqual(debts.length);
  });

  it("three people, various splits", () => {
    // alice paid 120 for dinner: alice owes 40, bob owes 40, carol owes 40
    // bob paid 60 for drinks: bob owes 20, alice owes 20, carol owes 20
    const debts: Debt[] = [
      { from: "bob", to: "alice", amount: 40 },
      { from: "carol", to: "alice", amount: 40 },
      { from: "alice", to: "bob", amount: 20 },
      { from: "carol", to: "bob", amount: 20 },
    ];
    // Net: alice = 40 + 40 - 20 = 60 credited; bob = -40 + 20 + 20 = 0; carol = -40 - 20 = -60
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: "carol", to: "alice", amount: 60 });
    expect(balancesMatch(debts, result)).toBe(true);
  });

  it("large group with many expenses", () => {
    const debts: Debt[] = [
      { from: "b", to: "a", amount: 25 },
      { from: "c", to: "a", amount: 25 },
      { from: "d", to: "a", amount: 25 },
      { from: "e", to: "a", amount: 25 },
      { from: "a", to: "b", amount: 10 },
      { from: "c", to: "b", amount: 10 },
      { from: "d", to: "b", amount: 10 },
      { from: "a", to: "c", amount: 5 },
      { from: "b", to: "c", amount: 5 },
    ];
    const result = simplifyDebts(debts);
    expect(balancesMatch(debts, result)).toBe(true);
    // Result should have fewer or equal transactions
    expect(result.length).toBeLessThanOrEqual(debts.length);
    // All amounts should be positive
    for (const d of result) {
      expect(d.amount).toBeGreaterThan(0);
    }
  });

  it("single person group — no debts", () => {
    const debts: Debt[] = [];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(0);
  });

  it("two people, mutual debts cancel out", () => {
    const debts: Debt[] = [
      { from: "alice", to: "bob", amount: 40 },
      { from: "bob", to: "alice", amount: 40 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(0);
  });

  it("two people, partial mutual debts net correctly", () => {
    const debts: Debt[] = [
      { from: "alice", to: "bob", amount: 60 },
      { from: "bob", to: "alice", amount: 20 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: "alice", to: "bob", amount: 40 });
    expect(balancesMatch(debts, result)).toBe(true);
  });

  it("four people, one creditor many debtors", () => {
    const debts: Debt[] = [
      { from: "b", to: "a", amount: 10 },
      { from: "c", to: "a", amount: 20 },
      { from: "d", to: "a", amount: 30 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(3);
    expect(balancesMatch(debts, result)).toBe(true);
  });
});
