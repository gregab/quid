import type { ExpenseForDebt } from "./buildRawDebts";
import { buildRawDebts } from "./buildRawDebts";
import { simplifyDebts } from "./simplify";

/**
 * Returns how much a user owes (in cents) after debt simplification.
 * Sums all simplified debts where `from === userId`.
 * Returns 0 if the user owes nothing (or is owed money).
 */
export function getUserDebtCents(
  expenses: ExpenseForDebt[],
  userId: string
): number {
  const simplified = simplifyDebts(buildRawDebts(expenses));
  let total = 0;
  for (const debt of simplified) {
    if (debt.from === userId) total += debt.amount;
  }
  return total;
}

/**
 * Returns a user's net balance (in cents) after debt simplification.
 * Positive = others owe the user (creditor). Negative = user owes others (debtor).
 * Returns 0 if the user has no outstanding debts in either direction.
 */
export function getUserBalanceCents(
  expenses: ExpenseForDebt[],
  userId: string
): number {
  const simplified = simplifyDebts(buildRawDebts(expenses));
  let balance = 0;
  for (const debt of simplified) {
    if (debt.to === userId) balance += debt.amount;
    if (debt.from === userId) balance -= debt.amount;
  }
  return balance;
}
