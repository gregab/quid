export interface GroupBill {
  id: string;
  groupId: string;
  createdById: string;
  receiptImageUrl: string; // signed URL (resolved client-side from storage path)
  name: string;
  receiptType: "meal" | "other";
  status: "in_progress" | "finalized";
  expenseId: string | null;
  createdAt: string;
  items: GroupBillItem[];
}

export interface GroupBillItem {
  id: string;
  groupBillId: string;
  description: string;
  amountCents: number;
  isTaxOrTip: boolean;
  claimedByUserIds: string[];
  sortOrder: number;
}

// Summary used for listing bills (no items array)
export interface GroupBillSummary {
  id: string;
  groupId: string;
  name: string;
  status: "in_progress" | "finalized";
  expenseId: string | null;
  createdAt: string;
  receiptImageUrl: string;
  itemCount: number;
  unclaimedCount: number; // regular items with zero claimants
}

/**
 * Compute the per-person split amounts from a finalized bill.
 *
 * Algorithm:
 * 1. Separate items into regular items and tax/tip items
 * 2. For each regular item: split amountCents equally among claimedByUserIds
 *    (use floor division, add remainder to first claimer)
 * 3. Compute each person's subtotal from regular items
 * 4. Distribute tax/tip items proportionally based on subtotals
 *    (for each tax/tip item, distribute proportionally; use floor + remainder to first person)
 * 5. Sum regular + tax/tip amounts per person
 * 6. Only include users who have at least some claim
 *
 * Items with empty claimedByUserIds are skipped entirely.
 * Returns Array<{ userId: string; amountCents: number }> sorted by userId.
 */
export function computeBillSplits(
  items: GroupBillItem[]
): Array<{ userId: string; amountCents: number }> {
  const regularItems = items.filter((item) => !item.isTaxOrTip);
  const taxTipItems = items.filter((item) => item.isTaxOrTip);

  // Step 1: Compute regular item amounts per person
  const regularAmounts = new Map<string, number>();

  for (const item of regularItems) {
    const claimers = item.claimedByUserIds;
    if (claimers.length === 0) continue;

    const n = claimers.length;
    const perPerson = Math.floor(item.amountCents / n);
    const remainder = item.amountCents % n;

    for (let i = 0; i < claimers.length; i++) {
      const userId = claimers[i];
      const share = perPerson + (i === 0 ? remainder : 0);
      regularAmounts.set(userId, (regularAmounts.get(userId) ?? 0) + share);
    }
  }

  // Step 2: Compute total subtotal across all people
  const totalSubtotal = Array.from(regularAmounts.values()).reduce(
    (sum, v) => sum + v,
    0
  );

  // Step 3: Distribute tax/tip proportionally
  const taxTipAmounts = new Map<string, number>();

  for (const item of taxTipItems) {
    if (totalSubtotal === 0) continue; // skip if no claimed regular items

    const userIds = Array.from(regularAmounts.keys());
    if (userIds.length === 0) continue;

    let remaining = item.amountCents;
    const shares = new Map<string, number>();

    for (const userId of userIds) {
      const personSubtotal = regularAmounts.get(userId) ?? 0;
      const share = Math.floor(
        (item.amountCents * personSubtotal) / totalSubtotal
      );
      shares.set(userId, share);
      remaining -= share;
    }

    // Assign remainder to person with highest subtotal (first if tied)
    if (remaining > 0) {
      let maxSubtotal = -1;
      let maxUserId: string | null = null;
      for (const userId of userIds) {
        const subtotal = regularAmounts.get(userId) ?? 0;
        if (subtotal > maxSubtotal) {
          maxSubtotal = subtotal;
          maxUserId = userId;
        }
      }
      if (maxUserId !== null) {
        shares.set(maxUserId, (shares.get(maxUserId) ?? 0) + remaining);
      }
    }

    for (const [userId, share] of shares) {
      taxTipAmounts.set(userId, (taxTipAmounts.get(userId) ?? 0) + share);
    }
  }

  // Step 4: Sum regular + tax/tip per person, exclude users who owe 0
  const allUserIds = new Set([
    ...regularAmounts.keys(),
    ...taxTipAmounts.keys(),
  ]);

  const result: Array<{ userId: string; amountCents: number }> = [];

  for (const userId of allUserIds) {
    const total =
      (regularAmounts.get(userId) ?? 0) + (taxTipAmounts.get(userId) ?? 0);
    if (total > 0) {
      result.push({ userId, amountCents: total });
    }
  }

  // Sort by userId for determinism
  result.sort((a, b) => a.userId.localeCompare(b.userId));

  return result;
}
