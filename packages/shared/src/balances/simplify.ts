export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/**
 * Simplifies a list of debts by minimizing the number of transactions
 * needed to settle all balances.
 *
 * Algorithm:
 * 1. Compute net balance per person (positive = owed money, negative = owes money)
 * 2. Split into creditors and debtors
 * 3. Greedily match each debtor to a creditor, creating a single transaction
 */
export function simplifyDebts(debts: Debt[]): Debt[] {
  if (debts.length === 0) return [];

  // Build net balance map
  const balance = new Map<string, number>();

  for (const { from, to, amount } of debts) {
    if (amount === 0) continue;
    balance.set(from, (balance.get(from) ?? 0) - amount);
    balance.set(to, (balance.get(to) ?? 0) + amount);
  }

  // Separate into creditors (balance > 0) and debtors (balance < 0)
  const creditors: Array<{ id: string; amount: number }> = [];
  const debtors: Array<{ id: string; amount: number }> = [];

  for (const [id, net] of balance.entries()) {
    if (net > 0) creditors.push({ id, amount: net });
    else if (net < 0) debtors.push({ id, amount: -net });
  }

  const result: Debt[] = [];
  let ci = 0;
  let di = 0;
  let creditorRemainder = creditors[ci]?.amount ?? 0;
  let debtorRemainder = debtors[di]?.amount ?? 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const settled = Math.min(creditorRemainder, debtorRemainder);

    result.push({ from: debtor.id, to: creditor.id, amount: settled });

    creditorRemainder -= settled;
    debtorRemainder -= settled;

    if (creditorRemainder === 0) {
      ci++;
      creditorRemainder = creditors[ci]?.amount ?? 0;
    }
    if (debtorRemainder === 0) {
      di++;
      debtorRemainder = debtors[di]?.amount ?? 0;
    }
  }

  return result;
}
