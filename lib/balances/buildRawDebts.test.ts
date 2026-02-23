import { describe, it, expect } from "vitest";
import { buildRawDebts, type ExpenseForDebt } from "./buildRawDebts";
import { simplifyDebts } from "./simplify";
import { splitAmount } from "./splitAmount";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal expense with equal splits (mirrors app's equal-split logic). */
function makeEqualExpense(opts: {
  id?: string;
  paidById: string;
  amountCents: number;
  participantIds: string[];
}): ExpenseForDebt {
  const splits = splitAmount(opts.amountCents, opts.participantIds.length);
  return {
    paidById: opts.paidById,
    splits: opts.participantIds.map((userId, i) => ({
      userId,
      amountCents: splits[i]!,
    })),
  };
}

/** Build a payment expense (paidById = sender, single split for recipient). */
function makePayment(opts: {
  senderId: string;
  recipientId: string;
  amountCents: number;
}): ExpenseForDebt {
  return {
    paidById: opts.senderId,
    splits: [{ userId: opts.recipientId, amountCents: opts.amountCents }],
  };
}

/** Compute net balance per person across a list of raw debts. */
function netBalances(debts: ReturnType<typeof buildRawDebts>): Map<string, number> {
  const map = new Map<string, number>();
  for (const { from, to, amount } of debts) {
    map.set(from, (map.get(from) ?? 0) - amount);
    map.set(to, (map.get(to) ?? 0) + amount);
  }
  return map;
}

/** Returns the net balance of a specific person after simplification. */
function getNet(simplified: ReturnType<typeof simplifyDebts>, personId: string): number {
  return simplified.reduce((acc, d) => {
    if (d.to === personId) return acc + d.amount;
    if (d.from === personId) return acc - d.amount;
    return acc;
  }, 0);
}

// ─── Payer exclusion ─────────────────────────────────────────────────────────

describe("buildRawDebts — payer exclusion", () => {
  it("payer's own split is never included as a debt", () => {
    // Alice pays $90, split 3 ways: all three have a split record
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 9000,
      participantIds: ["alice", "bob", "carol"],
    });
    const debts = buildRawDebts([expense]);

    // Only bob and carol should have debts — alice's own split is excluded
    expect(debts).toHaveLength(2);
    expect(debts.every((d) => d.from !== "alice")).toBe(true);
    expect(debts.every((d) => d.to === "alice")).toBe(true);
  });

  it("payer not in splits array at all — all splits become debts", () => {
    // Edge case: payer has no split record (shouldn't happen in practice, but
    // the function should still build debts for all split participants)
    const expense: ExpenseForDebt = {
      paidById: "alice",
      splits: [
        { userId: "bob", amountCents: 5000 },
        { userId: "carol", amountCents: 5000 },
      ],
    };
    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(2);
    expect(debts[0]).toEqual({ from: "bob", to: "alice", amount: 5000 });
    expect(debts[1]).toEqual({ from: "carol", to: "alice", amount: 5000 });
  });

  it("payer is the only participant — no debts produced", () => {
    const expense: ExpenseForDebt = {
      paidById: "alice",
      splits: [{ userId: "alice", amountCents: 10000 }],
    };
    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(0);
  });

  it("multiple expenses — payer exclusion works independently per expense", () => {
    const exp1 = makeEqualExpense({
      paidById: "alice",
      amountCents: 6000,
      participantIds: ["alice", "bob", "carol"],
    });
    const exp2 = makeEqualExpense({
      paidById: "bob",
      amountCents: 3000,
      participantIds: ["alice", "bob"],
    });
    const debts = buildRawDebts([exp1, exp2]);

    // exp1: bob and carol owe alice (alice's own split excluded)
    // exp2: alice owes bob (bob's own split excluded)
    const fromAlice = debts.filter((d) => d.from === "alice");
    const fromBob = debts.filter((d) => d.from === "bob");
    const fromCarol = debts.filter((d) => d.from === "carol");

    expect(fromAlice).toHaveLength(1); // alice owes bob
    expect(fromBob).toHaveLength(1); // bob owes alice
    expect(fromCarol).toHaveLength(1); // carol owes alice
  });
});

// ─── Equal splits ────────────────────────────────────────────────────────────

describe("buildRawDebts — equal splits", () => {
  it("two people: payer and one other", () => {
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 1000,
      participantIds: ["alice", "bob"],
    });
    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toEqual({ from: "bob", to: "alice", amount: 500 });
  });

  it("four people, equal split — amounts sum correctly", () => {
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob", "carol", "dave"],
    });
    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(3);
    const total = debts.reduce((sum, d) => sum + d.amount, 0);
    // alice paid 10000, her own share is 2500, so others owe 7500 total
    expect(total).toBe(7500);
  });

  it("uneven split — remainder cent goes to first participant (payer), others get base", () => {
    // $10.01 split 3 ways: [334, 334, 333] — payer is index 0 (gets 334)
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 1001,
      participantIds: ["alice", "bob", "carol"],
    });
    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(2);
    // splits: alice=334, bob=334, carol=333
    expect(debts.find((d) => d.from === "bob")?.amount).toBe(334);
    expect(debts.find((d) => d.from === "carol")?.amount).toBe(333);
    expect(debts.reduce((sum, d) => sum + d.amount, 0)).toBe(667);
  });

  it("$0.01 split 3 ways — two people owe nothing (zero splits not included as debts)", () => {
    // 1 cent / 3 people = [1, 0, 0] — payer gets the cent, others owe nothing
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 1,
      participantIds: ["alice", "bob", "carol"],
    });
    const debts = buildRawDebts([expense]);
    // bob and carol each have a split of 0, so they're in the splits array
    // but simplifyDebts will ignore zero amounts
    const nonZeroDebts = debts.filter((d) => d.amount > 0);
    expect(nonZeroDebts).toHaveLength(0);
  });

  it("zero-amount expense — no meaningful debts", () => {
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 0,
      participantIds: ["alice", "bob", "carol"],
    });
    const debts = buildRawDebts([expense]);
    const total = debts.reduce((sum, d) => sum + d.amount, 0);
    expect(total).toBe(0);
  });
});

// ─── Custom splits ────────────────────────────────────────────────────────────

describe("buildRawDebts — custom splits", () => {
  it("custom split: one person owes most of expense", () => {
    // Alice pays $90 for 3 people; custom split: alice=1000, bob=7000, carol=1000
    const expense: ExpenseForDebt = {
      paidById: "alice",
      splits: [
        { userId: "alice", amountCents: 1000 },
        { userId: "bob", amountCents: 7000 },
        { userId: "carol", amountCents: 1000 },
      ],
    };
    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(2);
    expect(debts.find((d) => d.from === "bob")?.amount).toBe(7000);
    expect(debts.find((d) => d.from === "carol")?.amount).toBe(1000);
  });

  it("custom split: payer covers own portion only, others owe full amounts", () => {
    // Bob pays $100, split: alice=6000, bob=2000, carol=2000
    const expense: ExpenseForDebt = {
      paidById: "bob",
      splits: [
        { userId: "alice", amountCents: 6000 },
        { userId: "bob", amountCents: 2000 },
        { userId: "carol", amountCents: 2000 },
      ],
    };
    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(2);
    expect(debts.find((d) => d.from === "alice")?.amount).toBe(6000);
    expect(debts.find((d) => d.from === "carol")?.amount).toBe(2000);
    expect(debts.every((d) => d.to === "bob")).toBe(true);
  });

  it("custom split: one participant has zero share (opted out but in group)", () => {
    const expense: ExpenseForDebt = {
      paidById: "alice",
      splits: [
        { userId: "alice", amountCents: 5000 },
        { userId: "bob", amountCents: 5000 },
        { userId: "carol", amountCents: 0 }, // carol not participating
      ],
    };
    const debts = buildRawDebts([expense]);
    // Both bob and carol appear in splits, but carol owes 0
    const carolDebt = debts.find((d) => d.from === "carol");
    expect(carolDebt?.amount ?? 0).toBe(0);
    const bobDebt = debts.find((d) => d.from === "bob");
    expect(bobDebt?.amount).toBe(5000);
  });

  it("custom splits amounts are used exactly as-is (no re-derivation)", () => {
    // Verifies the function doesn't try to recalculate splits
    const expense: ExpenseForDebt = {
      paidById: "alice",
      splits: [
        { userId: "alice", amountCents: 3333 },
        { userId: "bob", amountCents: 3333 },
        { userId: "carol", amountCents: 3334 }, // one extra cent
      ],
    };
    const debts = buildRawDebts([expense]);
    expect(debts.find((d) => d.from === "bob")?.amount).toBe(3333);
    expect(debts.find((d) => d.from === "carol")?.amount).toBe(3334);
  });
});

// ─── Payment expenses ─────────────────────────────────────────────────────────

describe("buildRawDebts — payment expenses", () => {
  it("payment creates a debt from recipient to sender", () => {
    // Bob pays Alice $50 outside the app
    // paidById=bob (sender), split={alice: 5000}
    const payment = makePayment({
      senderId: "bob",
      recipientId: "alice",
      amountCents: 5000,
    });
    const debts = buildRawDebts([payment]);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toEqual({ from: "alice", to: "bob", amount: 5000 });
  });

  it("payment cancels an equal debt — group settles to zero", () => {
    // Alice paid $100 dinner, Bob owes Alice $50
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    });

    // Bob pays Alice $50 back
    const payment = makePayment({
      senderId: "bob",
      recipientId: "alice",
      amountCents: 5000,
    });

    const rawDebts = buildRawDebts([expense, payment]);
    const simplified = simplifyDebts(rawDebts);

    // Net: bob owes alice 5000 (expense) - alice owes bob 5000 (payment) = 0
    expect(simplified).toHaveLength(0);
  });

  it("payment partially cancels a debt", () => {
    // Alice paid $100 split equally, Bob owes $50
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    });

    // Bob pays Alice $30
    const payment = makePayment({
      senderId: "bob",
      recipientId: "alice",
      amountCents: 3000,
    });

    const rawDebts = buildRawDebts([expense, payment]);
    const simplified = simplifyDebts(rawDebts);

    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "bob", to: "alice", amount: 2000 });
  });

  it("payment overcorrects — now payer owes recipient", () => {
    // Alice paid $100 split 2 ways, Bob owes $50
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    });

    // Bob pays Alice $70 (overpays by $20)
    const payment = makePayment({
      senderId: "bob",
      recipientId: "alice",
      amountCents: 7000,
    });

    const rawDebts = buildRawDebts([expense, payment]);
    const simplified = simplifyDebts(rawDebts);

    // Net: bob was owed 5000 back but paid 7000 → alice now owes bob 2000
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "alice", to: "bob", amount: 2000 });
  });

  it("multiple payments between the same pair", () => {
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 30000, // alice paid $300, bob owes $150
      participantIds: ["alice", "bob"],
    });

    // Bob makes three partial payments: $50, $50, $50
    const payments = [
      makePayment({ senderId: "bob", recipientId: "alice", amountCents: 5000 }),
      makePayment({ senderId: "bob", recipientId: "alice", amountCents: 5000 }),
      makePayment({ senderId: "bob", recipientId: "alice", amountCents: 5000 }),
    ];

    const rawDebts = buildRawDebts([expense, ...payments]);
    const simplified = simplifyDebts(rawDebts);

    expect(simplified).toHaveLength(0); // 15000 owed, 15000 paid = settled
  });

  it("payment between two people in a 4-person group doesn't affect others", () => {
    // Group has 4 people; alice paid $100 split 4 ways
    const expense = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob", "carol", "dave"],
    });

    // Bob pays Alice $25 (his share)
    const payment = makePayment({
      senderId: "bob",
      recipientId: "alice",
      amountCents: 2500,
    });

    const rawDebts = buildRawDebts([expense, payment]);
    const simplified = simplifyDebts(rawDebts);

    // Bob's debt is settled; carol and dave still owe alice
    const bobNet = getNet(simplified, "bob");
    expect(bobNet).toBe(0);

    const carolNet = getNet(simplified, "carol");
    expect(carolNet).toBe(-2500); // carol owes alice 2500

    const daveNet = getNet(simplified, "dave");
    expect(daveNet).toBe(-2500); // dave owes alice 2500

    const aliceNet = getNet(simplified, "alice");
    expect(aliceNet).toBe(5000); // alice is still owed 5000 total
  });
});

// ─── Multi-expense scenarios ──────────────────────────────────────────────────

describe("buildRawDebts — multi-expense scenarios", () => {
  it("empty expense list returns empty debts", () => {
    expect(buildRawDebts([])).toHaveLength(0);
  });

  it("two expenses with same payer accumulate correctly", () => {
    const exp1 = makeEqualExpense({
      paidById: "alice",
      amountCents: 6000,
      participantIds: ["alice", "bob"],
    });
    const exp2 = makeEqualExpense({
      paidById: "alice",
      amountCents: 4000,
      participantIds: ["alice", "bob"],
    });
    const rawDebts = buildRawDebts([exp1, exp2]);
    const simplified = simplifyDebts(rawDebts);

    // Bob owes alice 3000 + 2000 = 5000
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "bob", to: "alice", amount: 5000 });
  });

  it("mutual expenses between two people cancel down to one debt", () => {
    const exp1 = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    }); // bob owes alice 5000

    const exp2 = makeEqualExpense({
      paidById: "bob",
      amountCents: 6000,
      participantIds: ["alice", "bob"],
    }); // alice owes bob 3000

    const rawDebts = buildRawDebts([exp1, exp2]);
    const simplified = simplifyDebts(rawDebts);

    // Net: bob owes alice 5000 - 3000 = 2000
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "bob", to: "alice", amount: 2000 });
  });

  it("3-person group: triangle of debts simplifies correctly", () => {
    // Alice pays dinner: bob and carol each owe alice
    const dinner = makeEqualExpense({
      paidById: "alice",
      amountCents: 9000,
      participantIds: ["alice", "bob", "carol"],
    });

    // Bob pays drinks: alice and carol each owe bob
    const drinks = makeEqualExpense({
      paidById: "bob",
      amountCents: 6000,
      participantIds: ["alice", "bob", "carol"],
    });

    // Carol pays gas: alice and bob each owe carol
    const gas = makeEqualExpense({
      paidById: "carol",
      amountCents: 3000,
      participantIds: ["alice", "bob", "carol"],
    });

    const rawDebts = buildRawDebts([dinner, drinks, gas]);
    const simplified = simplifyDebts(rawDebts);

    // Net balances:
    // alice: +6000 (owed from dinner) - 2000 (drinks) - 1000 (gas) = +3000
    // bob: +4000 (owed from drinks) - 3000 (dinner) - 1000 (gas) = 0
    // carol: +2000 (owed from gas) - 3000 (dinner) - 2000 (drinks) = -3000
    // So: carol owes alice 3000
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "carol", to: "alice", amount: 3000 });
  });

  it("5-person group, various payers — net balances preserved", () => {
    const expenses = [
      makeEqualExpense({ paidById: "a", amountCents: 15000, participantIds: ["a", "b", "c", "d", "e"] }),
      makeEqualExpense({ paidById: "b", amountCents: 8000, participantIds: ["a", "b", "c"] }),
      makeEqualExpense({ paidById: "c", amountCents: 5000, participantIds: ["c", "d", "e"] }),
      makeEqualExpense({ paidById: "d", amountCents: 9000, participantIds: ["a", "b", "d"] }),
      makeEqualExpense({ paidById: "e", amountCents: 3000, participantIds: ["b", "c", "d", "e"] }),
    ];

    const rawDebts = buildRawDebts(expenses);
    const simplified = simplifyDebts(rawDebts);

    // Verify net balances are preserved through the full pipeline
    const origBal = netBalances(rawDebts);
    const simpBal = netBalances(simplified);
    const allPeople = new Set([...origBal.keys(), ...simpBal.keys()]);
    for (const person of allPeople) {
      expect(simpBal.get(person) ?? 0).toBe(origBal.get(person) ?? 0);
    }
  });

  it("everyone paid same amount for same participants — all settled", () => {
    const people = ["a", "b", "c", "d"];
    const expenses = people.map((payer) =>
      makeEqualExpense({
        paidById: payer,
        amountCents: 4000,
        participantIds: people,
      })
    );

    const rawDebts = buildRawDebts(expenses);
    const simplified = simplifyDebts(rawDebts);
    expect(simplified).toHaveLength(0);
  });
});

// ─── Mixed scenarios: expenses + custom splits + payments ─────────────────────

describe("buildRawDebts — mixed real-world scenarios", () => {
  it("weekend trip: equal expenses + one custom + one payment", () => {
    // Hotel: alice pays $300, split equally 3 ways (alice, bob, carol)
    const hotel = makeEqualExpense({
      paidById: "alice",
      amountCents: 30000,
      participantIds: ["alice", "bob", "carol"],
    });

    // Dinner: bob pays $90, custom split (bob=3000, alice=5000, carol=1000)
    const dinner: ExpenseForDebt = {
      paidById: "bob",
      splits: [
        { userId: "bob", amountCents: 3000 },
        { userId: "alice", amountCents: 5000 },
        { userId: "carol", amountCents: 1000 },
      ],
    };

    // Gas: carol pays $45, equal split 3 ways
    const gas = makeEqualExpense({
      paidById: "carol",
      amountCents: 4500,
      participantIds: ["alice", "bob", "carol"],
    });

    // Bob pays alice $50 directly
    const payment = makePayment({
      senderId: "bob",
      recipientId: "alice",
      amountCents: 5000,
    });

    const rawDebts = buildRawDebts([hotel, dinner, gas, payment]);
    const simplified = simplifyDebts(rawDebts);

    // Verify net balances preserved end-to-end
    const origBal = netBalances(rawDebts);
    const simpBal = netBalances(simplified);
    const allPeople = new Set([...origBal.keys(), ...simpBal.keys()]);
    for (const person of allPeople) {
      expect(simpBal.get(person) ?? 0).toBe(origBal.get(person) ?? 0);
    }

    // Verify specific amounts:
    // Hotel: bob owes alice 10000, carol owes alice 10000
    // Dinner: alice owes bob 5000, carol owes bob 1000
    // Gas: alice owes carol 1500, bob owes carol 1500
    // Payment: alice owes bob 5000 (from payment: bob sent alice 5000 cents outside the app)
    //
    // Net alice: +20000(hotel) - 5000(dinner) - 1500(gas) - 5000(payment) = +8500
    // Net bob: +6000(dinner) - 10000(hotel) - 1500(gas) + 5000(payment recv) = -500
    // Net carol: +3000(gas) - 10000(hotel) - 1000(dinner) = -8000
    // Check: 8500 - 500 - 8000 = 0 ✓

    expect(getNet(simplified, "alice")).toBe(8500);
    expect(getNet(simplified, "bob")).toBe(-500);
    expect(getNet(simplified, "carol")).toBe(-8000);
  });

  it("expense edited: amount changed — only final splits matter", () => {
    // This tests that after editing, we use the new splits only.
    // If expense was edited from $100 to $60, the DB only has the new splits.
    const beforeEdit = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    });
    const afterEdit = makeEqualExpense({
      paidById: "alice",
      amountCents: 6000,
      participantIds: ["alice", "bob"],
    });

    // The app stores only the latest version — test final state
    const rawDebts = buildRawDebts([afterEdit]);
    const simplified = simplifyDebts(rawDebts);

    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "bob", to: "alice", amount: 3000 });

    // Contrast with before-edit state
    const beforeDebts = buildRawDebts([beforeEdit]);
    const beforeSimplified = simplifyDebts(beforeDebts);
    expect(beforeSimplified[0]).toMatchObject({ from: "bob", to: "alice", amount: 5000 });
  });

  it("expense edited: payer changed — debts reverse direction", () => {
    // Originally alice paid, now bob is the payer
    const afterEdit = makeEqualExpense({
      paidById: "bob",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    });

    const rawDebts = buildRawDebts([afterEdit]);
    const simplified = simplifyDebts(rawDebts);

    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "alice", to: "bob", amount: 5000 });
  });

  it("expense edited: participant removed — removed person no longer owes", () => {
    // After edit, carol was removed from participants
    const afterEdit = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob"], // carol removed
    });

    const rawDebts = buildRawDebts([afterEdit]);
    const simplified = simplifyDebts(rawDebts);

    const carolDebt = simplified.find((d) => d.from === "carol" || d.to === "carol");
    expect(carolDebt).toBeUndefined();
  });

  it("expense edited: changed from equal to custom splits", () => {
    // After editing to custom splits: bob owes much more, carol owes much less
    const afterEdit: ExpenseForDebt = {
      paidById: "alice",
      splits: [
        { userId: "alice", amountCents: 1000 },
        { userId: "bob", amountCents: 8000 },
        { userId: "carol", amountCents: 1000 },
      ],
    };

    const rawDebts = buildRawDebts([afterEdit]);
    const simplified = simplifyDebts(rawDebts);

    expect(simplified.find((d) => d.from === "bob")?.amount).toBe(8000);
    expect(simplified.find((d) => d.from === "carol")?.amount).toBe(1000);
  });
});

// ─── Full pipeline: complex group scenarios ───────────────────────────────────

describe("buildRawDebts + simplifyDebts — full pipeline", () => {
  it("transaction count is always ≤ (people - 1) for any expense set", () => {
    const people = ["a", "b", "c", "d", "e", "f"];

    // 20 random-ish expenses with varying payers and participant sets
    const expenses: ExpenseForDebt[] = [];
    for (let i = 0; i < 20; i++) {
      const payer = people[i % people.length]!;
      const numParticipants = (i % 4) + 2;
      const participants = [payer];
      for (const p of people) {
        if (p !== payer && participants.length < numParticipants) participants.push(p);
      }
      expenses.push(
        makeEqualExpense({ paidById: payer, amountCents: (i + 1) * 1000, participantIds: participants })
      );
    }

    const rawDebts = buildRawDebts(expenses);
    const simplified = simplifyDebts(rawDebts);

    expect(simplified.length).toBeLessThanOrEqual(people.length - 1);
  });

  it("100 expenses in a 10-person group — net balances preserved exactly", () => {
    const people = Array.from({ length: 10 }, (_, i) => `user_${i}`);
    const expenses: ExpenseForDebt[] = [];

    for (let e = 0; e < 100; e++) {
      const payer = people[e % 10]!;
      const numParticipants = (e % 9) + 2;
      const participants = people.slice(0, numParticipants);
      if (!participants.includes(payer)) participants[0] = payer;
      expenses.push(
        makeEqualExpense({ paidById: payer, amountCents: (e + 1) * 137, participantIds: participants })
      );
    }

    const rawDebts = buildRawDebts(expenses);
    const simplified = simplifyDebts(rawDebts);

    // Verify conservation of money
    const origBal = netBalances(rawDebts);
    const simpBal = netBalances(simplified);
    const allPeople = new Set([...origBal.keys(), ...simpBal.keys()]);
    for (const person of allPeople) {
      expect(simpBal.get(person) ?? 0).toBe(origBal.get(person) ?? 0);
    }
  });

  it("mix of equal expenses + custom splits + payments — group settles correctly", () => {
    // Scenario: 4 friends on a road trip
    // alice pays $200 gas, equal 4 ways
    const gas = makeEqualExpense({
      paidById: "alice",
      amountCents: 20000,
      participantIds: ["alice", "bob", "carol", "dave"],
    });

    // bob pays $150 hotel, custom: alice=4000, bob=4000, carol=4000, dave=3000
    const hotel: ExpenseForDebt = {
      paidById: "bob",
      splits: [
        { userId: "alice", amountCents: 4000 },
        { userId: "bob", amountCents: 4000 },
        { userId: "carol", amountCents: 4000 },
        { userId: "dave", amountCents: 3000 },
      ],
    };

    // carol pays $80 food, equal 3 ways (alice, carol, dave only)
    const food = makeEqualExpense({
      paidById: "carol",
      amountCents: 7500,
      participantIds: ["alice", "carol", "dave"],
    });

    // dave pays alice $10 directly
    const payment = makePayment({ senderId: "dave", recipientId: "alice", amountCents: 1000 });

    const rawDebts = buildRawDebts([gas, hotel, food, payment]);
    const simplified = simplifyDebts(rawDebts);

    // Net balances preserved
    const origBal = netBalances(rawDebts);
    const simpBal = netBalances(simplified);
    const allPeople = new Set([...origBal.keys(), ...simpBal.keys()]);
    for (const person of allPeople) {
      expect(simpBal.get(person) ?? 0).toBe(origBal.get(person) ?? 0);
    }

    // Sum of all positive net balances (total money owed) is the same
    let origPos = 0;
    let simpPos = 0;
    for (const v of origBal.values()) if (v > 0) origPos += v;
    for (const v of simpBal.values()) if (v > 0) simpPos += v;
    expect(simpPos).toBe(origPos);
  });

  it("group with many payments — balances converge toward zero", () => {
    const people = ["alice", "bob", "carol"];

    // Create some debts
    const expenses = [
      makeEqualExpense({ paidById: "alice", amountCents: 9000, participantIds: people }),
      makeEqualExpense({ paidById: "bob", amountCents: 6000, participantIds: people }),
    ];

    // Net after expenses:
    // alice: receives 3000 (bob) + 3000 (carol) - 2000 (alice owes bob) = +4000
    // bob:   receives 2000 (alice) + 2000 (carol) - 3000 (bob owes alice) = +1000
    // carol: -3000 (owes alice) - 2000 (owes bob) = -5000

    // Simplified debts: carol owes alice 4000, carol owes bob 1000
    // carol pays alice 4000 and bob 1000 to fully settle
    const payment1 = makePayment({ senderId: "carol", recipientId: "alice", amountCents: 4000 });
    const payment2 = makePayment({ senderId: "carol", recipientId: "bob", amountCents: 1000 });

    const rawDebts = buildRawDebts([...expenses, payment1, payment2]);
    const simplified = simplifyDebts(rawDebts);

    // All debts fully cancelled
    expect(simplified).toHaveLength(0);
  });

  it("adding then deleting an expense returns to original state", () => {
    // Start: alice owes bob $50 from one expense
    const base = makeEqualExpense({
      paidById: "bob",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    });

    const baseSimplified = simplifyDebts(buildRawDebts([base]));
    expect(baseSimplified[0]).toMatchObject({ from: "alice", to: "bob", amount: 5000 });

    // Add an expense (alice paid $100, bob owes alice $50)
    const added = makeEqualExpense({
      paidById: "alice",
      amountCents: 10000,
      participantIds: ["alice", "bob"],
    });
    const afterAdd = simplifyDebts(buildRawDebts([base, added]));
    expect(afterAdd).toHaveLength(0); // debts cancel out

    // Delete the added expense → back to original
    const afterDelete = simplifyDebts(buildRawDebts([base]));
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]).toMatchObject({ from: "alice", to: "bob", amount: 5000 });
  });

  it("large-scale stress: 50 expenses, 8 people, net balances always conserved", () => {
    const people = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const expenses: ExpenseForDebt[] = [];

    for (let e = 0; e < 50; e++) {
      const payer = people[e % 8]!;
      const numParticipants = Math.max(2, (e % 7) + 1);
      const participants: string[] = [payer];
      for (const p of people) {
        if (p !== payer && participants.length < numParticipants) participants.push(p);
      }
      const amountCents = (e + 1) * 299; // various amounts
      expenses.push(makeEqualExpense({ paidById: payer, amountCents, participantIds: participants }));
    }

    // Add some payments
    for (let i = 0; i < 5; i++) {
      expenses.push(
        makePayment({
          senderId: people[i]!,
          recipientId: people[(i + 3) % 8]!,
          amountCents: (i + 1) * 1000,
        })
      );
    }

    const rawDebts = buildRawDebts(expenses);
    const simplified = simplifyDebts(rawDebts);

    // Conservation of money
    const origBal = netBalances(rawDebts);
    const simpBal = netBalances(simplified);
    const allPeople = new Set([...origBal.keys(), ...simpBal.keys()]);
    for (const person of allPeople) {
      expect(simpBal.get(person) ?? 0).toBe(origBal.get(person) ?? 0);
    }

    // Transaction count minimized
    expect(simplified.length).toBeLessThanOrEqual(people.length - 1);
  });
});

// ─── Payer NOT a participant (bug repro + adjacent cases) ───────────────────

describe("buildRawDebts — payer excluded from participants", () => {
  it("BUG REPRO: A owes B, then A pays expense where only B participates — debt should reduce", () => {
    // Setup: B paid $100, split between A and B → A owes B $50
    const expense1 = makeEqualExpense({
      paidById: "B",
      amountCents: 10000,
      participantIds: ["A", "B"],
    });

    // Action: A pays $30 expense, only participant is B (A is NOT a participant)
    // This means B owes A $30 for this expense
    const expense2: ExpenseForDebt = {
      paidById: "A",
      splits: [{ userId: "B", amountCents: 3000 }],
    };

    const rawDebts = buildRawDebts([expense1, expense2]);
    const simplified = simplifyDebts(rawDebts);

    // Expected: A owes B $50 - $30 = $20
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "A", to: "B", amount: 2000 });
  });

  it("A owes B, A pays expense where only B participates for FULL amount — settles to zero", () => {
    const expense1 = makeEqualExpense({
      paidById: "B",
      amountCents: 10000,
      participantIds: ["A", "B"],
    }); // A owes B $50

    // A pays $50 expense, only B participates → B owes A $50
    const expense2: ExpenseForDebt = {
      paidById: "A",
      splits: [{ userId: "B", amountCents: 5000 }],
    };

    const rawDebts = buildRawDebts([expense1, expense2]);
    const simplified = simplifyDebts(rawDebts);

    // Net: A owes B $50 - $50 = $0
    expect(simplified).toHaveLength(0);
  });

  it("A owes B, A pays expense where only B participates for MORE than debt — reverses direction", () => {
    const expense1 = makeEqualExpense({
      paidById: "B",
      amountCents: 10000,
      participantIds: ["A", "B"],
    }); // A owes B $50

    // A pays $80 expense, only B participates → B owes A $80
    const expense2: ExpenseForDebt = {
      paidById: "A",
      splits: [{ userId: "B", amountCents: 8000 }],
    };

    const rawDebts = buildRawDebts([expense1, expense2]);
    const simplified = simplifyDebts(rawDebts);

    // Net: A owes B $50 - $80 = -$30 → B owes A $30
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "B", to: "A", amount: 3000 });
  });

  it("payer not a participant, multiple participants — all owe payer", () => {
    // A pays $90, split among B, C, D (A not included)
    const expense: ExpenseForDebt = {
      paidById: "A",
      splits: [
        { userId: "B", amountCents: 3000 },
        { userId: "C", amountCents: 3000 },
        { userId: "D", amountCents: 3000 },
      ],
    };

    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(3);
    expect(debts.every((d) => d.to === "A")).toBe(true);
    expect(debts.reduce((sum, d) => sum + d.amount, 0)).toBe(9000);
  });

  it("payer not a participant with equal split helper — single participant gets full amount", () => {
    // A pays $30, participant list is [B] only
    // Using splitAmount(3000, 1) which should give [3000]
    const expense = makeEqualExpense({
      paidById: "A",
      amountCents: 3000,
      participantIds: ["B"],
    });

    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toEqual({ from: "B", to: "A", amount: 3000 });
  });

  it("3-person group: A pays for B and C (not self) — B and C owe A full amount", () => {
    // A pays $60, split equally between B and C (A excluded)
    const expense = makeEqualExpense({
      paidById: "A",
      amountCents: 6000,
      participantIds: ["B", "C"],
    });

    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(2);
    expect(debts[0]).toEqual({ from: "B", to: "A", amount: 3000 });
    expect(debts[1]).toEqual({ from: "C", to: "A", amount: 3000 });

    const simplified = simplifyDebts(debts);
    const aNet = getNet(simplified, "A");
    expect(aNet).toBe(6000); // A is owed $60 total
  });

  it("complex: payer excluded + normal expenses + payments all interact correctly", () => {
    // B pays $100, split A and B → A owes B $50
    const exp1 = makeEqualExpense({
      paidById: "B",
      amountCents: 10000,
      participantIds: ["A", "B"],
    });

    // A pays $20 for B only (A not participant) → B owes A $20
    const exp2: ExpenseForDebt = {
      paidById: "A",
      splits: [{ userId: "B", amountCents: 2000 }],
    };

    // A makes a $10 payment to B → A owes B $10 (payment reduces A's debt)
    const payment = makePayment({
      senderId: "A",
      recipientId: "B",
      amountCents: 1000,
    });

    const rawDebts = buildRawDebts([exp1, exp2, payment]);
    const simplified = simplifyDebts(rawDebts);

    // Net A: owes B $50 (exp1) - owed $20 from B (exp2) - paid B $10 (payment) = owes B $20
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "A", to: "B", amount: 2000 });
  });

  it("payer excluded, custom splits — amounts used as-is", () => {
    // A pays $100, custom split: B=$70, C=$30 (A not included)
    const expense: ExpenseForDebt = {
      paidById: "A",
      splits: [
        { userId: "B", amountCents: 7000 },
        { userId: "C", amountCents: 3000 },
      ],
    };

    const debts = buildRawDebts([expense]);
    expect(debts).toHaveLength(2);
    expect(debts[0]).toEqual({ from: "B", to: "A", amount: 7000 });
    expect(debts[1]).toEqual({ from: "C", to: "A", amount: 3000 });
  });

  it("two expenses where same person pays for the other exclusively — debts accumulate", () => {
    // A pays $30 for B, then A pays $20 for B
    const exp1: ExpenseForDebt = {
      paidById: "A",
      splits: [{ userId: "B", amountCents: 3000 }],
    };
    const exp2: ExpenseForDebt = {
      paidById: "A",
      splits: [{ userId: "B", amountCents: 2000 }],
    };

    const rawDebts = buildRawDebts([exp1, exp2]);
    const simplified = simplifyDebts(rawDebts);

    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "B", to: "A", amount: 5000 });
  });

  it("both people pay for each other exclusively — nets correctly", () => {
    // A pays $30 for B only → B owes A $30
    const exp1: ExpenseForDebt = {
      paidById: "A",
      splits: [{ userId: "B", amountCents: 3000 }],
    };
    // B pays $50 for A only → A owes B $50
    const exp2: ExpenseForDebt = {
      paidById: "B",
      splits: [{ userId: "A", amountCents: 5000 }],
    };

    const rawDebts = buildRawDebts([exp1, exp2]);
    const simplified = simplifyDebts(rawDebts);

    // Net: A owes B $50 - $30 = $20
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toMatchObject({ from: "A", to: "B", amount: 2000 });
  });
});
