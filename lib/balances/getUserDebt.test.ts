import { describe, it, expect } from "vitest";
import { getUserDebtCents, getUserBalanceCents } from "./getUserDebt";
import type { ExpenseForDebt } from "./buildRawDebts";

describe("getUserDebtCents", () => {
  it("returns 0 for no expenses", () => {
    expect(getUserDebtCents([], "u1")).toBe(0);
  });

  it("returns 0 when user paid and is owed money", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 500 },
          { userId: "u2", amountCents: 500 },
        ],
      },
    ];
    expect(getUserDebtCents(expenses, "u1")).toBe(0);
  });

  it("returns the amount owed when user did not pay", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 500 },
          { userId: "u2", amountCents: 500 },
        ],
      },
    ];
    expect(getUserDebtCents(expenses, "u2")).toBe(500);
  });

  it("nets out debts in both directions", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 500 },
          { userId: "u2", amountCents: 500 },
        ],
      },
      {
        paidById: "u2",
        splits: [
          { userId: "u1", amountCents: 300 },
          { userId: "u2", amountCents: 300 },
        ],
      },
    ];
    // u2 owes u1: 500 - 300 = 200
    expect(getUserDebtCents(expenses, "u2")).toBe(200);
    expect(getUserDebtCents(expenses, "u1")).toBe(0);
  });

  it("returns 0 when user is not involved in any expenses", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 500 },
          { userId: "u2", amountCents: 500 },
        ],
      },
    ];
    expect(getUserDebtCents(expenses, "u3")).toBe(0);
  });

  it("handles multiple creditors correctly", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 300 },
          { userId: "u3", amountCents: 300 },
        ],
      },
      {
        paidById: "u2",
        splits: [
          { userId: "u2", amountCents: 400 },
          { userId: "u3", amountCents: 400 },
        ],
      },
    ];
    // u3 owes: 300 to u1 + 400 to u2 = 700 total
    expect(getUserDebtCents(expenses, "u3")).toBe(700);
  });
});

describe("getUserBalanceCents", () => {
  it("returns 0 for no expenses", () => {
    expect(getUserBalanceCents([], "u1")).toBe(0);
  });

  it("returns positive when user is owed money", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 500 },
          { userId: "u2", amountCents: 500 },
        ],
      },
    ];
    // u1 paid 1000, is owed 500 by u2
    expect(getUserBalanceCents(expenses, "u1")).toBe(500);
  });

  it("returns negative when user owes money", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 500 },
          { userId: "u2", amountCents: 500 },
        ],
      },
    ];
    expect(getUserBalanceCents(expenses, "u2")).toBe(-500);
  });

  it("nets out debts in both directions", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u1", amountCents: 500 },
          { userId: "u2", amountCents: 500 },
        ],
      },
      {
        paidById: "u2",
        splits: [
          { userId: "u1", amountCents: 300 },
          { userId: "u2", amountCents: 300 },
        ],
      },
    ];
    // u1 is owed 500, owes 300 → net +200
    expect(getUserBalanceCents(expenses, "u1")).toBe(200);
    // u2 owes 500, is owed 300 → net -200
    expect(getUserBalanceCents(expenses, "u2")).toBe(-200);
  });

  it("returns 0 when debts fully cancel in 3-person group", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u2", amountCents: 1000 },
        ],
      },
      {
        paidById: "u2",
        splits: [
          { userId: "u1", amountCents: 1000 },
        ],
      },
    ];
    expect(getUserBalanceCents(expenses, "u1")).toBe(0);
    expect(getUserBalanceCents(expenses, "u2")).toBe(0);
  });

  it("returns 0 for uninvolved user", () => {
    const expenses: ExpenseForDebt[] = [
      {
        paidById: "u1",
        splits: [
          { userId: "u2", amountCents: 500 },
        ],
      },
    ];
    expect(getUserBalanceCents(expenses, "u3")).toBe(0);
  });
});

// ─── Chain collapse & simplification redirection ──────────────────────────────
//
// These tests verify that getUserDebtCents / getUserBalanceCents return correct
// results when simplification "redirects" debts through pass-through nodes —
// i.e., after simplification a person ends up owing someone they never directly
// interacted with, or ceasing to owe someone they originally did.

/** Build a minimal expense where paidById paid and splits are explicit. */
function makeExpense(opts: {
  paidById: string;
  splits: Array<{ userId: string; amountCents: number }>;
}): ExpenseForDebt {
  return { paidById: opts.paidById, splits: opts.splits };
}

describe("chain collapse — getUserDebtCents", () => {
  it("simple A→B→C chain: A's debt is redirected to C; B nets to zero", () => {
    // B paid for A (A owes B $100).
    // C paid for B (B owes C $100).
    // Simplified net: A=-100, B=0, C=+100 → A owes C $100 directly.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 10000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 10000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(10000); // A owes C, not B
    expect(getUserDebtCents(expenses, "B")).toBe(0);     // B is pass-through
    expect(getUserDebtCents(expenses, "C")).toBe(0);     // C is a creditor
  });

  it("multi-hop chain A→B→C→D: A's debt collapses all the way to D", () => {
    // Each person owes the next $50.
    // Net: A=-50, B=0, C=0, D=+50 → A owes D $50 directly.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 5000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 5000 }] }),
      makeExpense({ paidById: "D", splits: [{ userId: "C", amountCents: 5000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(5000);
    expect(getUserDebtCents(expenses, "B")).toBe(0); // B passes through
    expect(getUserDebtCents(expenses, "C")).toBe(0); // C passes through
    expect(getUserDebtCents(expenses, "D")).toBe(0); // D is a creditor
  });

  it("diamond collapse: A owes B and C; B and C both owe D → A owes D", () => {
    // A owes B $50, A owes C $50.
    // B owes D $50, C owes D $50.
    // Net: A=-100, B=0, C=0, D=+100 → A owes D $100.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 5000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "A", amountCents: 5000 }] }),
      makeExpense({ paidById: "D", splits: [{ userId: "B", amountCents: 5000 }] }),
      makeExpense({ paidById: "D", splits: [{ userId: "C", amountCents: 5000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(10000); // owes D
    expect(getUserDebtCents(expenses, "B")).toBe(0);     // nets to 0
    expect(getUserDebtCents(expenses, "C")).toBe(0);     // nets to 0
    expect(getUserDebtCents(expenses, "D")).toBe(0);     // creditor
  });

  it("partial pass-through: A owes B more than B owes C — A owes both B and C", () => {
    // A owes B $100. B owes C $60.
    // Net: A=-100, B=+40, C=+60 → B is still a net creditor.
    // Simplified: A→B for 40, A→C for 60.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 10000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 6000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(10000); // A owes a total of 10000
    expect(getUserDebtCents(expenses, "B")).toBe(0);     // B is net creditor, owes nobody
    expect(getUserDebtCents(expenses, "C")).toBe(0);     // C is creditor
  });

  it("partial pass-through reversed: A owes B less than B owes C — A and B both owe C", () => {
    // A owes B $40. B owes C $100.
    // Net: A=-40, B=-60, C=+100 → both A and B are debtors to C.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 4000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 10000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(4000);  // A owes C $40
    expect(getUserDebtCents(expenses, "B")).toBe(6000);  // B owes C $60
    expect(getUserDebtCents(expenses, "C")).toBe(0);     // creditor
  });

  it("creditor becomes debtor: A is first owed money, then owes more", () => {
    // B paid $100 for A→ A owes B $50 (A has split, B paid)
    // C paid $200 for A → A owes C $100 (C paid, A split)
    // Then A paid $30 for just B → B owes A $30
    // Net A: +30 (B owes from A's expense) - 50 (B's expense) - 100 (C's expense) = -120
    const expenses: ExpenseForDebt[] = [
      // B paid 10000, split with A (each 5000) → A owes B 5000
      makeExpense({
        paidById: "B",
        splits: [{ userId: "A", amountCents: 5000 }, { userId: "B", amountCents: 5000 }],
      }),
      // C paid 20000, split with A (each 10000) → A owes C 10000
      makeExpense({
        paidById: "C",
        splits: [{ userId: "A", amountCents: 10000 }, { userId: "C", amountCents: 10000 }],
      }),
      // A paid 3000, only B participates → B owes A 3000
      makeExpense({ paidById: "A", splits: [{ userId: "B", amountCents: 3000 }] }),
    ];
    // Net A: +3000 - 5000 - 10000 = -12000 → A owes 12000 total
    expect(getUserDebtCents(expenses, "A")).toBe(12000);
    // Net B: +5000 - 3000 = +2000 → B is creditor
    expect(getUserDebtCents(expenses, "B")).toBe(0);
    // Net C: +10000 → C is creditor
    expect(getUserDebtCents(expenses, "C")).toBe(0);
  });

  it("getUserDebtCents returns 0 when user is a creditor, regardless of amount owed to them", () => {
    // A paid $300 for B, C, D. A is owed a lot.
    const expenses: ExpenseForDebt[] = [
      makeExpense({
        paidById: "A",
        splits: [
          { userId: "B", amountCents: 10000 },
          { userId: "C", amountCents: 10000 },
          { userId: "D", amountCents: 10000 },
        ],
      }),
    ];
    // A is a pure creditor — getUserDebtCents(A) must be 0
    expect(getUserDebtCents(expenses, "A")).toBe(0);
    expect(getUserDebtCents(expenses, "B")).toBe(10000);
  });

  it("payment creates a chain that collapses: A's expense debt is net-cancelled by payment", () => {
    // A owes B $100 (expense). A pays B $100 (payment).
    // Net: A=0, B=0 — all debts gone.
    const expenses: ExpenseForDebt[] = [
      // B paid, A owes B 10000
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 10000 }] }),
      // A makes payment to B: paidById=A, split={B: 10000}
      // → debt from B to A (alice got paid, so now B owes A... wait no)
      // makePayment: senderId=A, recipientId=B means paidById=A, splits=[{userId:B, 10000}]
      // → debt: B→A for 10000 (B received money from A)
      // Net: A owes B 10000, B owes A 10000 → cancels
      makeExpense({ paidById: "A", splits: [{ userId: "B", amountCents: 10000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(0);
    expect(getUserDebtCents(expenses, "B")).toBe(0);
  });

  it("hub-and-spoke: many people owe one hub, hub owes one creditor — all pay creditor directly", () => {
    // A, B, C, D each owe Hub $25. Hub owes X $100.
    // Net: A=-25, B=-25, C=-25, D=-25, Hub=+100-100=0, X=+100.
    // Simplified: A→X:25, B→X:25, C→X:25, D→X:25
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "Hub", splits: [{ userId: "A", amountCents: 2500 }] }),
      makeExpense({ paidById: "Hub", splits: [{ userId: "B", amountCents: 2500 }] }),
      makeExpense({ paidById: "Hub", splits: [{ userId: "C", amountCents: 2500 }] }),
      makeExpense({ paidById: "Hub", splits: [{ userId: "D", amountCents: 2500 }] }),
      makeExpense({ paidById: "X", splits: [{ userId: "Hub", amountCents: 10000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(2500);
    expect(getUserDebtCents(expenses, "B")).toBe(2500);
    expect(getUserDebtCents(expenses, "C")).toBe(2500);
    expect(getUserDebtCents(expenses, "D")).toBe(2500);
    expect(getUserDebtCents(expenses, "Hub")).toBe(0); // Hub nets to 0
    expect(getUserDebtCents(expenses, "X")).toBe(0);   // X is creditor
  });

  it("multiple parallel chains: two independent chains do not interfere", () => {
    // Chain 1: A→B→C (B pass-through, $50 each)
    // Chain 2: X→Y→Z (Y pass-through, $30 each)
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 5000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 5000 }] }),
      makeExpense({ paidById: "Y", splits: [{ userId: "X", amountCents: 3000 }] }),
      makeExpense({ paidById: "Z", splits: [{ userId: "Y", amountCents: 3000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(5000);
    expect(getUserDebtCents(expenses, "B")).toBe(0);
    expect(getUserDebtCents(expenses, "X")).toBe(3000);
    expect(getUserDebtCents(expenses, "Y")).toBe(0);
  });

  it("5-hop chain: A→B→C→D→E→F — only A owes F", () => {
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 1000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 1000 }] }),
      makeExpense({ paidById: "D", splits: [{ userId: "C", amountCents: 1000 }] }),
      makeExpense({ paidById: "E", splits: [{ userId: "D", amountCents: 1000 }] }),
      makeExpense({ paidById: "F", splits: [{ userId: "E", amountCents: 1000 }] }),
    ];
    expect(getUserDebtCents(expenses, "A")).toBe(1000);
    expect(getUserDebtCents(expenses, "B")).toBe(0); // pass-through
    expect(getUserDebtCents(expenses, "C")).toBe(0); // pass-through
    expect(getUserDebtCents(expenses, "D")).toBe(0); // pass-through
    expect(getUserDebtCents(expenses, "E")).toBe(0); // pass-through
    expect(getUserDebtCents(expenses, "F")).toBe(0); // creditor
  });
});

describe("chain collapse — getUserBalanceCents", () => {
  it("simple A→B→C: A has negative balance, B zero, C positive", () => {
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 10000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 10000 }] }),
    ];
    expect(getUserBalanceCents(expenses, "A")).toBe(-10000);
    expect(getUserBalanceCents(expenses, "B")).toBe(0);
    expect(getUserBalanceCents(expenses, "C")).toBe(10000);
  });

  it("diamond collapse: B and C net to zero, A is debtor, D is creditor", () => {
    // A owes B $50, A owes C $50. B owes D $50, C owes D $50.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 5000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "A", amountCents: 5000 }] }),
      makeExpense({ paidById: "D", splits: [{ userId: "B", amountCents: 5000 }] }),
      makeExpense({ paidById: "D", splits: [{ userId: "C", amountCents: 5000 }] }),
    ];
    expect(getUserBalanceCents(expenses, "A")).toBe(-10000);
    expect(getUserBalanceCents(expenses, "B")).toBe(0);
    expect(getUserBalanceCents(expenses, "C")).toBe(0);
    expect(getUserBalanceCents(expenses, "D")).toBe(10000);
  });

  it("partial pass-through: net balances are correct for all parties", () => {
    // A owes B $100. B owes C $60.
    // Net: A=-100, B=+40, C=+60.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 10000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 6000 }] }),
    ];
    expect(getUserBalanceCents(expenses, "A")).toBe(-10000);
    expect(getUserBalanceCents(expenses, "B")).toBe(4000);  // still a net creditor
    expect(getUserBalanceCents(expenses, "C")).toBe(6000);
  });

  it("creditor-becomes-debtor transition: sign flips when new expense outweighs credits", () => {
    // First: A is creditor (A paid $60 for B)
    let expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "A", splits: [{ userId: "B", amountCents: 6000 }] }),
    ];
    expect(getUserBalanceCents(expenses, "A")).toBe(6000);  // creditor

    // Now B pays $80 for A — A suddenly owes more than A is owed.
    expenses = [
      ...expenses,
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 8000 }] }),
    ];
    // Net A: +6000 - 8000 = -2000 → now a debtor
    expect(getUserBalanceCents(expenses, "A")).toBe(-2000);
    expect(getUserBalanceCents(expenses, "B")).toBe(2000);
  });

  it("hub-and-spoke: hub nets to zero, spokes are debtors, single creditor", () => {
    // A, B, C each owe Hub $20. Hub owes X $60.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "Hub", splits: [{ userId: "A", amountCents: 2000 }] }),
      makeExpense({ paidById: "Hub", splits: [{ userId: "B", amountCents: 2000 }] }),
      makeExpense({ paidById: "Hub", splits: [{ userId: "C", amountCents: 2000 }] }),
      makeExpense({ paidById: "X", splits: [{ userId: "Hub", amountCents: 6000 }] }),
    ];
    expect(getUserBalanceCents(expenses, "Hub")).toBe(0);
    expect(getUserBalanceCents(expenses, "A")).toBe(-2000);
    expect(getUserBalanceCents(expenses, "B")).toBe(-2000);
    expect(getUserBalanceCents(expenses, "C")).toBe(-2000);
    expect(getUserBalanceCents(expenses, "X")).toBe(6000);
  });

  it("asymmetric chain: A→B→C with different amounts — all net balances correct", () => {
    // A owes B $70. B owes C $100. (B is a partial debtor)
    // Net: A=-70, B=+70-100=-30, C=+100.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 7000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "B", amountCents: 10000 }] }),
    ];
    expect(getUserBalanceCents(expenses, "A")).toBe(-7000);
    expect(getUserBalanceCents(expenses, "B")).toBe(-3000); // B owes net 3000
    expect(getUserBalanceCents(expenses, "C")).toBe(10000);
  });

  it("circular debts all cancel: getUserBalanceCents returns 0 for everyone", () => {
    // A paid for B, B paid for C, C paid for A — all equal amounts.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "A", splits: [{ userId: "B", amountCents: 5000 }] }),
      makeExpense({ paidById: "B", splits: [{ userId: "C", amountCents: 5000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "A", amountCents: 5000 }] }),
    ];
    expect(getUserBalanceCents(expenses, "A")).toBe(0);
    expect(getUserBalanceCents(expenses, "B")).toBe(0);
    expect(getUserBalanceCents(expenses, "C")).toBe(0);
  });

  it("sum of all getUserBalanceCents across the group is always zero", () => {
    // No matter what expenses exist, money is conserved.
    const expenses: ExpenseForDebt[] = [
      makeExpense({
        paidById: "P",
        splits: [
          { userId: "A", amountCents: 3000 },
          { userId: "B", amountCents: 4000 },
          { userId: "P", amountCents: 3000 },
        ],
      }),
      makeExpense({ paidById: "A", splits: [{ userId: "B", amountCents: 2000 }] }),
      makeExpense({ paidById: "B", splits: [{ userId: "C", amountCents: 5000 }] }),
      makeExpense({ paidById: "C", splits: [{ userId: "P", amountCents: 1500 }] }),
    ];
    const people = ["A", "B", "C", "P"];
    const totalBalance = people.reduce(
      (sum, p) => sum + getUserBalanceCents(expenses, p),
      0
    );
    expect(totalBalance).toBe(0);
  });

  it("getUserBalanceCents reflects simplified net, not raw debt count", () => {
    // A has 3 separate expense-debts to B ($10, $20, $30) and one credit from B ($25).
    // Raw: A→B: 10+20+30=60, B→A: 25. Net A: -35.
    const expenses: ExpenseForDebt[] = [
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 1000 }] }),
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 2000 }] }),
      makeExpense({ paidById: "B", splits: [{ userId: "A", amountCents: 3000 }] }),
      makeExpense({ paidById: "A", splits: [{ userId: "B", amountCents: 2500 }] }),
    ];
    expect(getUserBalanceCents(expenses, "A")).toBe(-3500);
    expect(getUserBalanceCents(expenses, "B")).toBe(3500);
  });
});
