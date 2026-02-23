import { describe, it, expect } from "vitest";
import { getUserDebtCents } from "./getUserDebt";
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
