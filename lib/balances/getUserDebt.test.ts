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
