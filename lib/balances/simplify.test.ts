import { describe, it, expect } from "vitest";
import { simplifyDebts, type Debt } from "./simplify";
import { splitAmount } from "./splitAmount";

// ─── Test helpers ───────────────────────────────────────────────────────────

function netBalances(debts: Debt[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const { from, to, amount } of debts) {
    map.set(from, (map.get(from) ?? 0) - amount);
    map.set(to, (map.get(to) ?? 0) + amount);
  }
  return map;
}

/** Asserts the critical invariant: net balances are preserved exactly. */
function assertBalancesPreserved(original: Debt[], simplified: Debt[]) {
  const orig = netBalances(original);
  const simp = netBalances(simplified);
  const allPeople = new Set([...orig.keys(), ...simp.keys()]);
  for (const person of allPeople) {
    expect(simp.get(person) ?? 0).toBe(orig.get(person) ?? 0);
  }
}

/** Asserts all structural invariants that must hold for any valid simplification. */
function assertValidSimplification(original: Debt[], simplified: Debt[]) {
  // 1. Net balances preserved exactly (conservation of money)
  assertBalancesPreserved(original, simplified);

  // 2. No self-debts
  for (const d of simplified) {
    expect(d.from).not.toBe(d.to);
  }

  // 3. All amounts are positive integers
  for (const d of simplified) {
    expect(d.amount).toBeGreaterThan(0);
    expect(Number.isInteger(d.amount)).toBe(true);
  }

  // 4. Transaction count reduced or equal
  expect(simplified.length).toBeLessThanOrEqual(
    Math.max(original.length, countNonZeroBalances(original))
  );
}

function countNonZeroBalances(debts: Debt[]): number {
  const bal = netBalances(debts);
  let count = 0;
  for (const v of bal.values()) {
    if (v !== 0) count++;
  }
  return count;
}

/** Generate a random group of expenses, returns raw debts (like the app does). */
function generateRandomExpenses(opts: {
  people: number;
  expenses: number;
  maxAmountCents: number;
}): Debt[] {
  const ids = Array.from({ length: opts.people }, (_, i) => `user_${i}`);
  const debts: Debt[] = [];

  for (let e = 0; e < opts.expenses; e++) {
    const payerIdx = Math.floor(Math.random() * ids.length);
    const payer = ids[payerIdx]!;
    const amount = Math.floor(Math.random() * opts.maxAmountCents) + 1;

    // Random subset of participants (at least 2, including payer)
    const participantCount = Math.max(2, Math.floor(Math.random() * ids.length) + 1);
    const participants = [payer];
    const available = ids.filter((id) => id !== payer);
    for (let p = 0; p < participantCount - 1 && available.length > 0; p++) {
      const idx = Math.floor(Math.random() * available.length);
      participants.push(available.splice(idx, 1)[0]!);
    }

    // Use splitAmount to split evenly (mirrors app behavior)
    const splits = splitAmount(amount, participants.length);
    for (let i = 0; i < participants.length; i++) {
      if (participants[i] === payer) continue;
      if (splits[i]! > 0) {
        debts.push({ from: participants[i]!, to: payer, amount: splits[i]! });
      }
    }
  }

  return debts;
}

// ─── Existing tests (preserved) ────────────────────────────────────────────

describe("simplifyDebts", () => {
  it("handles empty input", () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it("two people, one expense", () => {
    const debts: Debt[] = [{ from: "alice", to: "bob", amount: 50 }];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: "alice", to: "bob", amount: 50 });
    assertValidSimplification(debts, result);
  });

  it("three people, alice paid for all", () => {
    const debts: Debt[] = [
      { from: "bob", to: "alice", amount: 30 },
      { from: "carol", to: "alice", amount: 30 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(2);
    assertValidSimplification(debts, result);
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
    const debts: Debt[] = [
      { from: "A", to: "B", amount: 30 },
      { from: "B", to: "C", amount: 30 },
      { from: "C", to: "A", amount: 30 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(0);
  });

  it("partial circular: A->B 30, B->C 20, C->A 10", () => {
    const debts: Debt[] = [
      { from: "A", to: "B", amount: 30 },
      { from: "B", to: "C", amount: 20 },
      { from: "C", to: "A", amount: 10 },
    ];
    const result = simplifyDebts(debts);
    assertValidSimplification(debts, result);
    expect(result.length).toBeLessThanOrEqual(debts.length);
  });

  it("three people, various splits", () => {
    const debts: Debt[] = [
      { from: "bob", to: "alice", amount: 40 },
      { from: "carol", to: "alice", amount: 40 },
      { from: "alice", to: "bob", amount: 20 },
      { from: "carol", to: "bob", amount: 20 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: "carol", to: "alice", amount: 60 });
    assertValidSimplification(debts, result);
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
    assertValidSimplification(debts, result);
  });

  it("single person group — no debts", () => {
    expect(simplifyDebts([])).toHaveLength(0);
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
    assertValidSimplification(debts, result);
  });

  it("four people, one creditor many debtors", () => {
    const debts: Debt[] = [
      { from: "b", to: "a", amount: 10 },
      { from: "c", to: "a", amount: 20 },
      { from: "d", to: "a", amount: 30 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(3);
    assertValidSimplification(debts, result);
  });

  // ─── NEW: Edge cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("single debt of 1 cent", () => {
      const debts: Debt[] = [{ from: "A", to: "B", amount: 1 }];
      const result = simplifyDebts(debts);
      expect(result).toEqual([{ from: "A", to: "B", amount: 1 }]);
    });

    it("many zero-amount debts mixed with real ones", () => {
      const debts: Debt[] = [
        { from: "A", to: "B", amount: 0 },
        { from: "B", to: "C", amount: 50 },
        { from: "C", to: "A", amount: 0 },
        { from: "A", to: "C", amount: 0 },
        { from: "C", to: "B", amount: 30 },
      ];
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      // B: -50 +30 = -20 (net debtor). C: +50 -30 = +20 (net creditor).
      // So one debt: B->C for 20
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ from: "B", to: "C", amount: 20 });
    });

    it("duplicate debts between same pair", () => {
      const debts: Debt[] = [
        { from: "A", to: "B", amount: 10 },
        { from: "A", to: "B", amount: 20 },
        { from: "A", to: "B", amount: 30 },
      ];
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ from: "A", to: "B", amount: 60 });
    });

    it("everyone owes everyone else equally → all settled", () => {
      // A->B 10, B->A 10, A->C 10, C->A 10, B->C 10, C->B 10
      const debts: Debt[] = [
        { from: "A", to: "B", amount: 10 },
        { from: "B", to: "A", amount: 10 },
        { from: "A", to: "C", amount: 10 },
        { from: "C", to: "A", amount: 10 },
        { from: "B", to: "C", amount: 10 },
        { from: "C", to: "B", amount: 10 },
      ];
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(0);
    });

    it("one person paid for everything, everyone else splits", () => {
      // Payer covered $100 for 5 people
      const debts: Debt[] = [
        { from: "B", to: "A", amount: 20 },
        { from: "C", to: "A", amount: 20 },
        { from: "D", to: "A", amount: 20 },
        { from: "E", to: "A", amount: 20 },
      ];
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(4);
      assertValidSimplification(debts, result);
      // Total owed to A should be 80
      const totalToA = result
        .filter((d) => d.to === "A")
        .reduce((sum, d) => sum + d.amount, 0);
      expect(totalToA).toBe(80);
    });

    it("chain of debts: A→B→C→D→E", () => {
      const debts: Debt[] = [
        { from: "A", to: "B", amount: 100 },
        { from: "B", to: "C", amount: 100 },
        { from: "C", to: "D", amount: 100 },
        { from: "D", to: "E", amount: 100 },
      ];
      // Net: A=-100, E=+100, everyone else 0
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ from: "A", to: "E", amount: 100 });
    });

    it("star topology: one creditor, many debtors with different amounts", () => {
      const debts: Debt[] = [
        { from: "B", to: "A", amount: 1 },
        { from: "C", to: "A", amount: 2 },
        { from: "D", to: "A", amount: 3 },
        { from: "E", to: "A", amount: 4 },
        { from: "F", to: "A", amount: 5 },
        { from: "G", to: "A", amount: 6 },
        { from: "H", to: "A", amount: 7 },
      ];
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(7);
      assertValidSimplification(debts, result);
      const totalToA = result.reduce((sum, d) => sum + d.amount, 0);
      expect(totalToA).toBe(28);
    });
  });

  // ─── NEW: Specific amount calculations ──────────────────────────────────

  describe("exact amount verification", () => {
    it("$33.33 split 3 ways (9999 cents / 3)", () => {
      // Real scenario: $99.99 dinner split 3 ways
      // Each person's share: 3333 cents, payer is owed 6666
      const debts: Debt[] = [
        { from: "B", to: "A", amount: 3333 },
        { from: "C", to: "A", amount: 3333 },
      ];
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      expect(result).toHaveLength(2);
      const totalToA = result.reduce((sum, d) => sum + d.amount, 0);
      expect(totalToA).toBe(6666);
    });

    it("uneven split with remainder cents", () => {
      // $10.00 split 3 ways: 334, 333, 333
      const splits = splitAmount(1000, 3);
      // Payer (index 0) gets 334, others owe their shares
      const debts: Debt[] = [
        { from: "B", to: "A", amount: splits[1]! },
        { from: "C", to: "A", amount: splits[2]! },
      ];
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      const totalToA = result.reduce((sum, d) => sum + d.amount, 0);
      expect(totalToA).toBe(splits[1]! + splits[2]!);
      expect(totalToA).toBe(666); // 333 + 333
    });

    it("complex real-world scenario: weekend trip", () => {
      // Alice paid $150 hotel (split 3 ways: 50 each, others owe 50)
      // Bob paid $90 dinner (split 3 ways: 30 each, others owe 30)
      // Carol paid $45 gas (split 3 ways: 15 each, others owe 15)
      const debts: Debt[] = [
        // Hotel: Bob and Carol owe Alice
        { from: "Bob", to: "Alice", amount: 5000 },
        { from: "Carol", to: "Alice", amount: 5000 },
        // Dinner: Alice and Carol owe Bob
        { from: "Alice", to: "Bob", amount: 3000 },
        { from: "Carol", to: "Bob", amount: 3000 },
        // Gas: Alice and Bob owe Carol
        { from: "Alice", to: "Carol", amount: 1500 },
        { from: "Bob", to: "Carol", amount: 1500 },
      ];
      // Net balances:
      // Alice: +10000 - 3000 - 1500 = +5500
      // Bob: +6000 - 5000 - 1500 = -500
      // Carol: +3000 - 5000 - 3000 = -5000
      // Verify: 5500 - 500 - 5000 = 0 ✓
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);

      const aliceNet = result.reduce((sum, d) => {
        if (d.to === "Alice") return sum + d.amount;
        if (d.from === "Alice") return sum - d.amount;
        return sum;
      }, 0);
      expect(aliceNet).toBe(5500);
    });

    it("many small expenses between two people", () => {
      // Simulating splitting coffee, lunch, etc. over a month
      const debts: Debt[] = [
        { from: "A", to: "B", amount: 350 }, // coffee
        { from: "B", to: "A", amount: 1200 }, // lunch
        { from: "A", to: "B", amount: 500 }, // coffee
        { from: "B", to: "A", amount: 800 }, // drinks
        { from: "A", to: "B", amount: 350 }, // coffee
        { from: "B", to: "A", amount: 1500 }, // dinner
        { from: "A", to: "B", amount: 275 }, // snack
      ];
      // A owes B: 350 + 500 + 350 + 275 = 1475
      // B owes A: 1200 + 800 + 1500 = 3500
      // Net: A is owed 2025
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ from: "B", to: "A", amount: 2025 });
    });
  });

  // ─── NEW: Multi-payer scenarios ─────────────────────────────────────────

  describe("multi-payer scenarios", () => {
    it("5 people, 10 expenses, various payers", () => {
      const people = ["A", "B", "C", "D", "E"];
      const debts: Debt[] = [];

      // Expense 1: A pays $100, split 5 ways (each owes 20)
      for (const p of people) {
        if (p !== "A") debts.push({ from: p, to: "A", amount: 2000 });
      }
      // Expense 2: B pays $50, split 5 ways (each owes 10)
      for (const p of people) {
        if (p !== "B") debts.push({ from: p, to: "B", amount: 1000 });
      }
      // Expense 3: C pays $75, split 3 ways (A,B,C — each owes 25)
      for (const p of ["A", "B"]) {
        debts.push({ from: p, to: "C", amount: 2500 });
      }
      // Expense 4: D pays $30, split 2 ways (D,E — E owes 15)
      debts.push({ from: "E", to: "D", amount: 1500 });

      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);

      // Verify total money in system is conserved
      const origNet = netBalances(debts);
      let totalPositive = 0;
      for (const v of origNet.values()) {
        if (v > 0) totalPositive += v;
      }
      const resultNet = netBalances(result);
      let resultPositive = 0;
      for (const v of resultNet.values()) {
        if (v > 0) resultPositive += v;
      }
      expect(resultPositive).toBe(totalPositive);
    });

    it("everyone paid for one expense each (equal amounts) → all settled", () => {
      // 4 people, each paid $40 split 4 ways (each person owes $10 per expense)
      const people = ["A", "B", "C", "D"];
      const debts: Debt[] = [];
      for (const payer of people) {
        for (const other of people) {
          if (other !== payer) {
            debts.push({ from: other, to: payer, amount: 1000 });
          }
        }
      }
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(0);
    });

    it("two big spenders, three freeloaders", () => {
      const debts: Debt[] = [];
      // A pays $300, split 5 ways (60 each, others owe 60)
      for (const p of ["C", "D", "E"]) {
        debts.push({ from: p, to: "A", amount: 6000 });
      }
      debts.push({ from: "B", to: "A", amount: 6000 });
      // B pays $200, split 5 ways (40 each, others owe 40)
      for (const p of ["C", "D", "E"]) {
        debts.push({ from: p, to: "B", amount: 4000 });
      }
      debts.push({ from: "A", to: "B", amount: 4000 });

      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      // Net: A = +24000 - 4000 = +20000; B = +16000 - 6000 = +10000
      // C,D,E each = -6000 - 4000 = -10000
      // Check: 20000 + 10000 - 30000 = 0 ✓
    });
  });

  // ─── NEW: Stress tests with splitAmount integration ─────────────────────

  describe("integration with splitAmount", () => {
    it("$1.00 split among 3 people creates correct debts", () => {
      const splits = splitAmount(100, 3); // [34, 33, 33]
      const payer = "A";
      const participants = ["A", "B", "C"];
      const debts: Debt[] = [];
      participants.forEach((uid, i) => {
        if (uid !== payer) {
          debts.push({ from: uid, to: payer, amount: splits[i]! });
        }
      });
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      const totalOwed = result.reduce((sum, d) => sum + d.amount, 0);
      // B owes 33, C owes 33 = 66 (payer's share was 34, total = 100)
      expect(totalOwed).toBe(66);
    });

    it("$0.01 split among 7 people", () => {
      const splits = splitAmount(1, 7); // [1, 0, 0, 0, 0, 0, 0]
      const payer = "A";
      const participants = ["A", "B", "C", "D", "E", "F", "G"];
      const debts: Debt[] = [];
      participants.forEach((uid, i) => {
        if (uid !== payer && splits[i]! > 0) {
          debts.push({ from: uid, to: payer, amount: splits[i]! });
        }
      });
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      // Payer got the only cent, no one else owes anything
      expect(result).toHaveLength(0);
    });

    it("$999.99 split among 7 people across multiple expenses", () => {
      const people = ["A", "B", "C", "D", "E", "F", "G"];
      const allDebts: Debt[] = [];

      // 5 expenses, each $999.99 (99999 cents), different payers
      for (let e = 0; e < 5; e++) {
        const payer = people[e % people.length]!;
        const splits = splitAmount(99999, people.length);
        people.forEach((uid, i) => {
          if (uid !== payer && splits[i]! > 0) {
            allDebts.push({ from: uid, to: payer, amount: splits[i]! });
          }
        });
      }

      const result = simplifyDebts(allDebts);
      assertValidSimplification(allDebts, result);
    });
  });

  // ─── NEW: Property-based stress tests ───────────────────────────────────

  describe("randomized stress tests", () => {
    it("conservation of money: 500 random scenarios with 2-5 people", () => {
      for (let i = 0; i < 500; i++) {
        const debts = generateRandomExpenses({
          people: Math.floor(Math.random() * 4) + 2,
          expenses: Math.floor(Math.random() * 10) + 1,
          maxAmountCents: 100000,
        });
        const result = simplifyDebts(debts);
        assertValidSimplification(debts, result);
      }
    });

    it("conservation of money: 200 random scenarios with 5-15 people", () => {
      for (let i = 0; i < 200; i++) {
        const debts = generateRandomExpenses({
          people: Math.floor(Math.random() * 11) + 5,
          expenses: Math.floor(Math.random() * 20) + 5,
          maxAmountCents: 500000,
        });
        const result = simplifyDebts(debts);
        assertValidSimplification(debts, result);
      }
    });

    it("conservation of money: 50 random scenarios with 15-30 people", () => {
      for (let i = 0; i < 50; i++) {
        const debts = generateRandomExpenses({
          people: Math.floor(Math.random() * 16) + 15,
          expenses: Math.floor(Math.random() * 50) + 10,
          maxAmountCents: 1000000,
        });
        const result = simplifyDebts(debts);
        assertValidSimplification(debts, result);
      }
    });

    it("conservation with very small amounts (1-10 cents)", () => {
      for (let i = 0; i < 200; i++) {
        const debts = generateRandomExpenses({
          people: Math.floor(Math.random() * 5) + 2,
          expenses: Math.floor(Math.random() * 20) + 5,
          maxAmountCents: 10,
        });
        const result = simplifyDebts(debts);
        assertValidSimplification(debts, result);
      }
    });

    it("conservation with very large amounts ($10k-$100k per expense)", () => {
      for (let i = 0; i < 100; i++) {
        const debts = generateRandomExpenses({
          people: Math.floor(Math.random() * 8) + 2,
          expenses: Math.floor(Math.random() * 10) + 1,
          maxAmountCents: 10_000_000,
        });
        const result = simplifyDebts(debts);
        assertValidSimplification(debts, result);
      }
    });

    it("transaction count is always ≤ (number of people - 1)", () => {
      for (let i = 0; i < 300; i++) {
        const numPeople = Math.floor(Math.random() * 10) + 2;
        const debts = generateRandomExpenses({
          people: numPeople,
          expenses: Math.floor(Math.random() * 20) + 1,
          maxAmountCents: 50000,
        });
        const result = simplifyDebts(debts);
        // Greedy algorithm guarantees at most (n-1) transactions
        expect(result.length).toBeLessThanOrEqual(numPeople - 1);
      }
    });

    it("idempotent: simplifying already-simplified debts gives same result", () => {
      for (let i = 0; i < 200; i++) {
        const debts = generateRandomExpenses({
          people: Math.floor(Math.random() * 8) + 2,
          expenses: Math.floor(Math.random() * 15) + 1,
          maxAmountCents: 100000,
        });
        const first = simplifyDebts(debts);
        const second = simplifyDebts(first);
        assertBalancesPreserved(first, second);
        expect(second.length).toBeLessThanOrEqual(first.length);
      }
    });

    it("total money owed never changes across simplification", () => {
      for (let i = 0; i < 200; i++) {
        const debts = generateRandomExpenses({
          people: Math.floor(Math.random() * 10) + 2,
          expenses: Math.floor(Math.random() * 15) + 1,
          maxAmountCents: 200000,
        });
        const result = simplifyDebts(debts);

        // Sum of all positive net balances must be identical
        const origBal = netBalances(debts);
        const resBal = netBalances(result);

        let origPositive = 0;
        let resPositive = 0;
        for (const v of origBal.values()) if (v > 0) origPositive += v;
        for (const v of resBal.values()) if (v > 0) resPositive += v;

        expect(resPositive).toBe(origPositive);
      }
    });
  });

  // ─── NEW: Deterministic stress scenarios ────────────────────────────────

  describe("deterministic large scenarios", () => {
    it("20 people, round-robin expenses", () => {
      const people = Array.from({ length: 20 }, (_, i) => `p${i}`);
      const debts: Debt[] = [];

      // Each person pays for a $100 expense split among all 20
      for (const payer of people) {
        const splits = splitAmount(10000, 20);
        people.forEach((uid, i) => {
          if (uid !== payer && splits[i]! > 0) {
            debts.push({ from: uid, to: payer, amount: splits[i]! });
          }
        });
      }

      const result = simplifyDebts(debts);
      // Everyone paid the same, so all nets are 0
      expect(result).toHaveLength(0);
    });

    it("20 people, one person never pays", () => {
      const people = Array.from({ length: 20 }, (_, i) => `p${i}`);
      const debts: Debt[] = [];

      // p0 through p18 each pay $100 split among all 20
      for (let pIdx = 0; pIdx < 19; pIdx++) {
        const payer = people[pIdx]!;
        const splits = splitAmount(10000, 20);
        people.forEach((uid, i) => {
          if (uid !== payer && splits[i]! > 0) {
            debts.push({ from: uid, to: payer, amount: splits[i]! });
          }
        });
      }

      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      // p19 never paid, so p19 should owe the most
      const p19Net = netBalances(result).get("p19") ?? 0;
      expect(p19Net).toBeLessThan(0);
    });

    it("10 people, 100 expenses of varying sizes", () => {
      const people = Array.from({ length: 10 }, (_, i) => `user${i}`);
      const debts: Debt[] = [];

      for (let e = 0; e < 100; e++) {
        const payerIdx = e % 10;
        const payer = people[payerIdx]!;
        const amount = (e + 1) * 100; // 100, 200, 300, ...
        const numParticipants = (e % 9) + 2; // 2 to 10
        const participants = people.slice(0, numParticipants);
        if (!participants.includes(payer)) participants[0] = payer;

        const splits = splitAmount(amount, participants.length);
        participants.forEach((uid, i) => {
          if (uid !== payer && splits[i]! > 0) {
            debts.push({ from: uid, to: payer, amount: splits[i]! });
          }
        });
      }

      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      expect(result.length).toBeLessThanOrEqual(9); // at most n-1
    });

    it("worst case: maximum number of unique net balances", () => {
      // Create a scenario where everyone has a different net balance
      const debts: Debt[] = [
        { from: "A", to: "B", amount: 1 },
        { from: "A", to: "C", amount: 2 },
        { from: "A", to: "D", amount: 4 },
        { from: "A", to: "E", amount: 8 },
        { from: "A", to: "F", amount: 16 },
        { from: "A", to: "G", amount: 32 },
        { from: "A", to: "H", amount: 64 },
      ];
      // A owes 127 total, each creditor has a unique power-of-2 balance
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
    });

    it("pathological: 50 people, all owe person 0", () => {
      const debts: Debt[] = [];
      for (let i = 1; i < 50; i++) {
        debts.push({ from: `p${i}`, to: "p0", amount: i * 100 });
      }
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      expect(result).toHaveLength(49);
      const totalToP0 = result.reduce((sum, d) => sum + d.amount, 0);
      // Sum of 100 + 200 + ... + 4900 = 100 * (49 * 50 / 2) = 122500
      expect(totalToP0).toBe(122500);
    });
  });

  // ─── NEW: Rounding and precision ────────────────────────────────────────

  describe("rounding and precision", () => {
    it("splitting $1.00 among 3 never loses a cent", () => {
      const splits = splitAmount(100, 3);
      expect(splits.reduce((a, b) => a + b, 0)).toBe(100);

      // Use splits as debts (payer is index 0)
      const debts: Debt[] = [
        { from: "B", to: "A", amount: splits[1]! },
        { from: "C", to: "A", amount: splits[2]! },
      ];
      const result = simplifyDebts(debts);
      assertValidSimplification(debts, result);
      expect(result.reduce((sum, d) => sum + d.amount, 0)).toBe(66);
    });

    it("splitting $0.07 among 3 never loses a cent", () => {
      const splits = splitAmount(7, 3);
      expect(splits).toEqual([3, 2, 2]);
      expect(splits.reduce((a, b) => a + b, 0)).toBe(7);
    });

    it("splitting $0.01 among 100 people", () => {
      const splits = splitAmount(1, 100);
      expect(splits.reduce((a, b) => a + b, 0)).toBe(1);
      expect(splits.filter((s) => s === 1)).toHaveLength(1);
      expect(splits.filter((s) => s === 0)).toHaveLength(99);
    });

    it("no floating point contamination in large scenarios", () => {
      // Create debts that would cause float issues if we weren't using ints
      const debts: Debt[] = [];
      for (let i = 0; i < 100; i++) {
        debts.push({ from: "A", to: "B", amount: 33 }); // 0.33 * 100 in floats = issues
      }
      const result = simplifyDebts(debts);
      expect(result).toHaveLength(1);
      expect(result[0]!.amount).toBe(3300); // Exact, no float drift
    });

    it("consecutive splitAmount + simplify never loses or gains money", () => {
      // Simulate 20 expenses in a 5-person group
      const people = ["A", "B", "C", "D", "E"];
      const allDebts: Debt[] = [];
      let totalSpent = 0;

      const amounts = [
        1, 2, 3, 7, 11, 13, 99, 100, 101, 333, 997, 1000, 1001, 4999, 5000,
        5001, 9999, 10000, 10001, 99999,
      ];

      amounts.forEach((amount, idx) => {
        const payer = people[idx % 5]!;
        totalSpent += amount;
        const splits = splitAmount(amount, 5);
        people.forEach((uid, i) => {
          if (uid !== payer && splits[i]! > 0) {
            allDebts.push({ from: uid, to: payer, amount: splits[i]! });
          }
        });
      });

      const result = simplifyDebts(allDebts);
      assertValidSimplification(allDebts, result);

      // Verify: sum of all amounts in result equals sum of all amounts in input
      const inputTotal = allDebts.reduce((sum, d) => sum + d.amount, 0);
      const resultTotal = result.reduce((sum, d) => sum + d.amount, 0);
      // These won't necessarily be equal (simplification can reduce total flow)
      // But net balances must match
      assertBalancesPreserved(allDebts, result);

      // The total positive balances must match
      const inputBal = netBalances(allDebts);
      const resultBal = netBalances(result);
      let inputPos = 0;
      let resultPos = 0;
      for (const v of inputBal.values()) if (v > 0) inputPos += v;
      for (const v of resultBal.values()) if (v > 0) resultPos += v;
      expect(resultPos).toBe(inputPos);
    });
  });
});
