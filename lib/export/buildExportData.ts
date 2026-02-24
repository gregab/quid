import { buildRawDebts, type ExpenseForDebt } from "@/lib/balances/buildRawDebts";
import { simplifyDebts, type Debt } from "@/lib/balances/simplify";

/**
 * Input types for the export data builder.
 * These are intentionally minimal — callers construct them from whatever
 * data source they have (Supabase query result, client-side state, etc.).
 */
export interface ExportExpense {
  id: string;
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  paidById: string;
  isPayment: boolean;
  splits: Array<{ userId: string; amountCents: number }>;
}

export interface ExportMember {
  userId: string;
  displayName: string;
}

/**
 * Fully resolved row for the "All Expenses" sheet.
 */
export interface AllExpensesRow {
  date: string;
  description: string;
  type: "Expense" | "Payment";
  paidBy: string;
  totalCents: number;
  /** The current user's split amount, or null if they have no split. */
  yourShareCents: number | null;
}

/**
 * A single line item in the "What you owe" section.
 */
export interface YouOweRow {
  date: string;
  description: string;
  paidBy: string;
  yourShareCents: number;
}

/**
 * A single line item in the "What you're owed" section.
 */
export interface OwedToYouRow {
  date: string;
  description: string;
  who: string;
  theirShareCents: number;
}

/**
 * A single line item in the payments sections.
 */
export interface PaymentRow {
  date: string;
  otherParty: string;
  amountCents: number;
}

/**
 * A simplified debt for display.
 */
export interface SimplifiedDebtRow {
  from: string;
  to: string;
  amountCents: number;
}

/**
 * A single row in the "All Splits" sheet.
 */
export interface AllSplitsRow {
  date: string;
  description: string;
  type: "Expense" | "Payment";
  paidBy: string;
  participant: string;
  splitAmountCents: number;
}

/**
 * Complete export data, ready to be turned into a spreadsheet.
 */
export interface GroupExportData {
  groupName: string;
  exportedFor: string; // current user's display name
  exportDate: string; // YYYY-MM-DD

  allExpenses: AllExpensesRow[];
  youOwe: YouOweRow[];
  owedToYou: OwedToYouRow[];
  paymentsMade: PaymentRow[];
  paymentsReceived: PaymentRow[];

  totalYouOweCents: number;
  totalOwedToYouCents: number;
  totalPaymentsMadeCents: number;
  totalPaymentsReceivedCents: number;
  netBalanceCents: number;

  simplifiedDebts: SimplifiedDebtRow[];
  allSplits: AllSplitsRow[];
}

/**
 * Builds all the data needed for the export spreadsheet.
 * Pure function — no side effects, no database calls.
 */
export function buildGroupExportData(
  groupName: string,
  currentUserId: string,
  expenses: ExportExpense[],
  members: ExportMember[],
  allUserNames: Record<string, string>
): GroupExportData {
  const nameOf = (userId: string): string =>
    allUserNames[userId] ?? members.find((m) => m.userId === userId)?.displayName ?? "Unknown";

  const currentUserName = nameOf(currentUserId);

  // Sort expenses by date ascending for the export
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));

  // --- Sheet 1: All Expenses ---
  const allExpenses: AllExpensesRow[] = sorted.map((e) => {
    const userSplit = e.splits.find((s) => s.userId === currentUserId);
    let description = e.description;
    if (e.isPayment) {
      // For payments, show "Payer → Recipient" as description
      const recipientSplit = e.splits[0];
      const recipientName = recipientSplit ? nameOf(recipientSplit.userId) : "Unknown";
      description = `${nameOf(e.paidById)} → ${recipientName}`;
    }
    return {
      date: e.date,
      description,
      type: e.isPayment ? "Payment" : "Expense",
      paidBy: nameOf(e.paidById),
      totalCents: e.amountCents,
      yourShareCents: userSplit?.amountCents ?? null,
    };
  });

  // --- Sheet 2: Your Balance breakdown ---

  // What you owe: expenses where someone ELSE paid and you have a split
  const youOwe: YouOweRow[] = [];
  for (const e of sorted) {
    if (e.isPayment) continue;
    if (e.paidById === currentUserId) continue;
    const userSplit = e.splits.find((s) => s.userId === currentUserId);
    if (!userSplit || userSplit.amountCents === 0) continue;
    youOwe.push({
      date: e.date,
      description: e.description,
      paidBy: nameOf(e.paidById),
      yourShareCents: userSplit.amountCents,
    });
  }

  // What you're owed: expenses where YOU paid and others have splits
  const owedToYou: OwedToYouRow[] = [];
  for (const e of sorted) {
    if (e.isPayment) continue;
    if (e.paidById !== currentUserId) continue;
    for (const split of e.splits) {
      if (split.userId === currentUserId) continue;
      if (split.amountCents === 0) continue;
      owedToYou.push({
        date: e.date,
        description: e.description,
        who: nameOf(split.userId),
        theirShareCents: split.amountCents,
      });
    }
  }

  // Payments made by the current user
  const paymentsMade: PaymentRow[] = [];
  for (const e of sorted) {
    if (!e.isPayment) continue;
    if (e.paidById !== currentUserId) continue;
    const recipientSplit = e.splits[0];
    if (!recipientSplit) continue;
    paymentsMade.push({
      date: e.date,
      otherParty: nameOf(recipientSplit.userId),
      amountCents: e.amountCents,
    });
  }

  // Payments received by the current user
  const paymentsReceived: PaymentRow[] = [];
  for (const e of sorted) {
    if (!e.isPayment) continue;
    if (e.paidById === currentUserId) continue;
    const userSplit = e.splits.find((s) => s.userId === currentUserId);
    if (!userSplit) continue;
    paymentsReceived.push({
      date: e.date,
      otherParty: nameOf(e.paidById),
      amountCents: e.amountCents,
    });
  }

  // Totals
  const totalYouOweCents = youOwe.reduce((sum, r) => sum + r.yourShareCents, 0);
  const totalOwedToYouCents = owedToYou.reduce((sum, r) => sum + r.theirShareCents, 0);
  const totalPaymentsMadeCents = paymentsMade.reduce((sum, r) => sum + r.amountCents, 0);
  const totalPaymentsReceivedCents = paymentsReceived.reduce((sum, r) => sum + r.amountCents, 0);

  // Net balance via the standard pipeline (this is what the app shows)
  const expensesForDebt: ExpenseForDebt[] = expenses.map((e) => ({
    paidById: e.paidById,
    splits: e.splits,
  }));
  const simplified: Debt[] = simplifyDebts(buildRawDebts(expensesForDebt));

  let netBalanceCents = 0;
  for (const debt of simplified) {
    if (debt.to === currentUserId) netBalanceCents += debt.amount;
    if (debt.from === currentUserId) netBalanceCents -= debt.amount;
  }

  const simplifiedDebts: SimplifiedDebtRow[] = simplified.map((d) => ({
    from: nameOf(d.from),
    to: nameOf(d.to),
    amountCents: d.amount,
  }));

  // --- Sheet 3: All Splits ---
  const allSplits: AllSplitsRow[] = [];
  for (const e of sorted) {
    for (const split of e.splits) {
      allSplits.push({
        date: e.date,
        description: e.isPayment
          ? `Payment: ${nameOf(e.paidById)} → ${nameOf(split.userId)}`
          : e.description,
        type: e.isPayment ? "Payment" : "Expense",
        paidBy: nameOf(e.paidById),
        participant: nameOf(split.userId),
        splitAmountCents: split.amountCents,
      });
    }
  }

  return {
    groupName,
    exportedFor: currentUserName,
    exportDate: new Date().toISOString().split("T")[0]!,
    allExpenses,
    youOwe,
    owedToYou,
    paymentsMade,
    paymentsReceived,
    totalYouOweCents,
    totalOwedToYouCents,
    totalPaymentsMadeCents,
    totalPaymentsReceivedCents,
    netBalanceCents,
    simplifiedDebts,
    allSplits,
  };
}
