import type { Debt } from "./simplify";

/**
 * Minimal expense shape needed for debt computation.
 * Both ExpenseRow (client) and Supabase query results satisfy this interface.
 */
export interface ExpenseForDebt {
  paidById: string;
  splits: Array<{ userId: string; amountCents: number }>;
}

/**
 * Converts a list of expenses (with splits) into raw debt pairs.
 *
 * For each expense, each split participant (except the payer) creates a debt
 * from that participant TO the payer for their split amount. The payer's own
 * split is excluded — it represents their share of the cost, not a debt.
 *
 * The resulting Debt[] is intended to be passed directly to simplifyDebts().
 */
export function buildRawDebts(expenses: ExpenseForDebt[]): Debt[] {
  const debts: Debt[] = [];
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.userId === expense.paidById) continue;
      debts.push({
        from: split.userId,
        to: expense.paidById,
        amount: split.amountCents,
      });
    }
  }
  return debts;
}
