import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildGroupExportData,
  type ExportExpense,
  type ExportMember,
} from "./buildExportData";

const ALICE_ID = "alice-id";
const BOB_ID = "bob-id";
const CAROL_ID = "carol-id";

const members: ExportMember[] = [
  { userId: ALICE_ID, displayName: "Alice" },
  { userId: BOB_ID, displayName: "Bob" },
  { userId: CAROL_ID, displayName: "Carol" },
];

const allUserNames: Record<string, string> = {
  [ALICE_ID]: "Alice",
  [BOB_ID]: "Bob",
  [CAROL_ID]: "Carol",
};

// Fix Date for deterministic exportDate
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-03-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buildGroupExportData", () => {
  it("returns correct metadata", () => {
    const result = buildGroupExportData("Trip", ALICE_ID, [], members, allUserNames);
    expect(result.groupName).toBe("Trip");
    expect(result.exportedFor).toBe("Alice");
    expect(result.exportDate).toBe("2025-03-15");
  });

  it("returns empty arrays when no expenses", () => {
    const result = buildGroupExportData("Trip", ALICE_ID, [], members, allUserNames);
    expect(result.allExpenses).toEqual([]);
    expect(result.youOwe).toEqual([]);
    expect(result.owedToYou).toEqual([]);
    expect(result.paymentsMade).toEqual([]);
    expect(result.paymentsReceived).toEqual([]);
    expect(result.simplifiedDebts).toEqual([]);
    expect(result.allSplits).toEqual([]);
    expect(result.totalYouOweCents).toBe(0);
    expect(result.totalOwedToYouCents).toBe(0);
    expect(result.netBalanceCents).toBe(0);
  });

  describe("with a basic equal split expense", () => {
    // Alice pays $30 for Alice, Bob, Carol ($10 each)
    const expenses: ExportExpense[] = [
      {
        id: "exp-1",
        description: "Dinner",
        amountCents: 3000,
        date: "2025-01-15",
        paidById: ALICE_ID,
        isPayment: false,
        splits: [
          { userId: ALICE_ID, amountCents: 1000 },
          { userId: BOB_ID, amountCents: 1000 },
          { userId: CAROL_ID, amountCents: 1000 },
        ],
      },
    ];

    it("builds allExpenses correctly from Alice's perspective", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.allExpenses).toEqual([
        {
          date: "2025-01-15",
          description: "Dinner",
          type: "Expense",
          paidBy: "Alice",
          totalCents: 3000,
          yourShareCents: 1000,
        },
      ]);
    });

    it("Alice paid, so she has owedToYou entries (Bob and Carol owe her)", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.youOwe).toEqual([]);
      expect(result.owedToYou).toHaveLength(2);
      expect(result.owedToYou).toContainEqual({
        date: "2025-01-15",
        description: "Dinner",
        who: "Bob",
        theirShareCents: 1000,
      });
      expect(result.owedToYou).toContainEqual({
        date: "2025-01-15",
        description: "Dinner",
        who: "Carol",
        theirShareCents: 1000,
      });
      expect(result.totalOwedToYouCents).toBe(2000);
    });

    it("Bob didn't pay, so he has a youOwe entry", () => {
      const result = buildGroupExportData("Trip", BOB_ID, expenses, members, allUserNames);
      expect(result.youOwe).toEqual([
        {
          date: "2025-01-15",
          description: "Dinner",
          paidBy: "Alice",
          yourShareCents: 1000,
        },
      ]);
      expect(result.owedToYou).toEqual([]);
      expect(result.totalYouOweCents).toBe(1000);
    });

    it("computes simplified debts correctly", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      // Bob → Alice $10, Carol → Alice $10
      expect(result.simplifiedDebts).toHaveLength(2);
      const bobDebt = result.simplifiedDebts.find((d) => d.from === "Bob");
      expect(bobDebt).toEqual({ from: "Bob", to: "Alice", amountCents: 1000 });
      const carolDebt = result.simplifiedDebts.find((d) => d.from === "Carol");
      expect(carolDebt).toEqual({ from: "Carol", to: "Alice", amountCents: 1000 });
    });

    it("net balance is positive for Alice (she is owed)", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.netBalanceCents).toBe(2000); // $20 owed to her
    });

    it("net balance is negative for Bob (he owes)", () => {
      const result = buildGroupExportData("Trip", BOB_ID, expenses, members, allUserNames);
      expect(result.netBalanceCents).toBe(-1000); // owes $10
    });

    it("builds allSplits correctly", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.allSplits).toHaveLength(3);
      expect(result.allSplits[0]).toEqual({
        date: "2025-01-15",
        description: "Dinner",
        type: "Expense",
        paidBy: "Alice",
        participant: "Alice",
        splitAmountCents: 1000,
      });
    });
  });

  describe("with payments", () => {
    // Bob pays Alice $10 (settling up)
    const expenses: ExportExpense[] = [
      {
        id: "exp-1",
        description: "Dinner",
        amountCents: 3000,
        date: "2025-01-15",
        paidById: ALICE_ID,
        isPayment: false,
        splits: [
          { userId: ALICE_ID, amountCents: 1000 },
          { userId: BOB_ID, amountCents: 1000 },
          { userId: CAROL_ID, amountCents: 1000 },
        ],
      },
      {
        id: "pmt-1",
        description: "Payment",
        amountCents: 1000,
        date: "2025-01-20",
        paidById: BOB_ID,
        isPayment: true,
        splits: [{ userId: ALICE_ID, amountCents: 1000 }],
      },
    ];

    it("tracks payments made by the current user (Bob)", () => {
      const result = buildGroupExportData("Trip", BOB_ID, expenses, members, allUserNames);
      expect(result.paymentsMade).toEqual([
        { date: "2025-01-20", otherParty: "Alice", amountCents: 1000 },
      ]);
      expect(result.totalPaymentsMadeCents).toBe(1000);
      expect(result.paymentsReceived).toEqual([]);
    });

    it("tracks payments received by the current user (Alice)", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.paymentsReceived).toEqual([
        { date: "2025-01-20", otherParty: "Bob", amountCents: 1000 },
      ]);
      expect(result.totalPaymentsReceivedCents).toBe(1000);
      expect(result.paymentsMade).toEqual([]);
    });

    it("payments show as 'Payer → Recipient' in allExpenses description", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      const paymentRow = result.allExpenses.find((e) => e.type === "Payment");
      expect(paymentRow?.description).toBe("Bob → Alice");
    });

    it("payments do NOT appear in youOwe or owedToYou", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      // Only the dinner should appear in owedToYou
      expect(result.owedToYou.every((r) => r.description === "Dinner")).toBe(true);
      expect(result.youOwe).toEqual([]);
    });
  });

  describe("with payer-excluded expense", () => {
    // Alice pays $60 for Bob and Carol only (Alice is NOT a participant)
    const expenses: ExportExpense[] = [
      {
        id: "exp-1",
        description: "Gift for Dave",
        amountCents: 6000,
        date: "2025-02-01",
        paidById: ALICE_ID,
        isPayment: false,
        splits: [
          { userId: BOB_ID, amountCents: 3000 },
          { userId: CAROL_ID, amountCents: 3000 },
        ],
      },
    ];

    it("Alice has no 'your share' since she's not a participant", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.allExpenses[0]?.yourShareCents).toBeNull();
    });

    it("Alice sees both Bob and Carol in owedToYou", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.owedToYou).toHaveLength(2);
      expect(result.totalOwedToYouCents).toBe(6000);
    });

    it("Bob sees his share in youOwe", () => {
      const result = buildGroupExportData("Trip", BOB_ID, expenses, members, allUserNames);
      expect(result.youOwe).toEqual([
        { date: "2025-02-01", description: "Gift for Dave", paidBy: "Alice", yourShareCents: 3000 },
      ]);
    });
  });

  describe("sorting", () => {
    const expenses: ExportExpense[] = [
      {
        id: "exp-2",
        description: "Later expense",
        amountCents: 2000,
        date: "2025-03-01",
        paidById: ALICE_ID,
        isPayment: false,
        splits: [
          { userId: ALICE_ID, amountCents: 1000 },
          { userId: BOB_ID, amountCents: 1000 },
        ],
      },
      {
        id: "exp-1",
        description: "Earlier expense",
        amountCents: 1000,
        date: "2025-01-01",
        paidById: ALICE_ID,
        isPayment: false,
        splits: [
          { userId: ALICE_ID, amountCents: 500 },
          { userId: BOB_ID, amountCents: 500 },
        ],
      },
    ];

    it("sorts expenses by date ascending", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.allExpenses[0]?.description).toBe("Earlier expense");
      expect(result.allExpenses[1]?.description).toBe("Later expense");
    });
  });

  describe("zero-amount splits", () => {
    const expenses: ExportExpense[] = [
      {
        id: "exp-1",
        description: "Dinner",
        amountCents: 2000,
        date: "2025-01-15",
        paidById: ALICE_ID,
        isPayment: false,
        splits: [
          { userId: ALICE_ID, amountCents: 2000 },
          { userId: BOB_ID, amountCents: 0 },
        ],
      },
    ];

    it("zero-amount splits are excluded from youOwe", () => {
      const result = buildGroupExportData("Trip", BOB_ID, expenses, members, allUserNames);
      expect(result.youOwe).toEqual([]);
    });

    it("zero-amount splits are excluded from owedToYou", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.owedToYou).toEqual([]);
    });
  });

  describe("unknown users", () => {
    it("falls back to 'Unknown' for unrecognized user IDs", () => {
      const expenses: ExportExpense[] = [
        {
          id: "exp-1",
          description: "Dinner",
          amountCents: 1000,
          date: "2025-01-15",
          paidById: "departed-user",
          isPayment: false,
          splits: [
            { userId: ALICE_ID, amountCents: 500 },
            { userId: "departed-user", amountCents: 500 },
          ],
        },
      ];
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      expect(result.allExpenses[0]?.paidBy).toBe("Unknown");
      expect(result.youOwe[0]?.paidBy).toBe("Unknown");
    });
  });

  describe("multiple expenses across multiple payers", () => {
    const expenses: ExportExpense[] = [
      {
        id: "exp-1",
        description: "Groceries",
        amountCents: 6000,
        date: "2025-01-10",
        paidById: ALICE_ID,
        isPayment: false,
        splits: [
          { userId: ALICE_ID, amountCents: 2000 },
          { userId: BOB_ID, amountCents: 2000 },
          { userId: CAROL_ID, amountCents: 2000 },
        ],
      },
      {
        id: "exp-2",
        description: "Movie tickets",
        amountCents: 3000,
        date: "2025-01-12",
        paidById: BOB_ID,
        isPayment: false,
        splits: [
          { userId: ALICE_ID, amountCents: 1000 },
          { userId: BOB_ID, amountCents: 1000 },
          { userId: CAROL_ID, amountCents: 1000 },
        ],
      },
    ];

    it("Alice sees both youOwe and owedToYou entries", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);

      // Alice paid groceries — Bob and Carol owe her $20 each
      expect(result.owedToYou).toHaveLength(2);
      expect(result.totalOwedToYouCents).toBe(4000);

      // Bob paid movie — Alice owes $10
      expect(result.youOwe).toHaveLength(1);
      expect(result.youOwe[0]?.paidBy).toBe("Bob");
      expect(result.totalYouOweCents).toBe(1000);
    });

    it("net balance reflects simplified debts", () => {
      const result = buildGroupExportData("Trip", ALICE_ID, expenses, members, allUserNames);
      // Alice is owed $40, owes $10 → net +$30
      expect(result.netBalanceCents).toBe(3000);
    });
  });
});
