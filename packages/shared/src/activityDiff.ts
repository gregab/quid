/**
 * Shared activity diff computation for expense edits.
 * Used by both the API route (server-side activity logging) and
 * the client (optimistic activity feed updates).
 */

export interface ExpenseChanges {
  amount?: { from: number; to: number };
  description?: { from: string; to: string };
  date?: { from: string; to: string };
  paidBy?: { from: string; to: string };
  participants?: { added: string[]; removed: string[] };
  splitType?: { from: string; to: string };
}

interface OldExpense {
  amountCents: number;
  description: string;
  /** YYYY-MM-DD (already extracted from ISO timestamp) */
  date: string;
  paidById: string;
  paidByDisplayName: string;
  /** Split type before the edit */
  splitType?: string;
}

interface NewExpense {
  amountCents: number;
  description: string;
  date: string;
  paidById: string;
  paidByDisplayName: string;
  splitType: string;
}

/**
 * Compute what changed between old and new expense state.
 * Display names for paidBy must be resolved by the caller.
 */
export function computeExpenseChanges(
  old: OldExpense,
  new_: NewExpense,
  oldParticipantIds: string[],
  newParticipantIds: string[],
  resolveDisplayName: (userId: string) => string,
): ExpenseChanges {
  const changes: ExpenseChanges = {};

  if (old.amountCents !== new_.amountCents) {
    changes.amount = { from: old.amountCents, to: new_.amountCents };
  }
  if (old.description !== new_.description) {
    changes.description = { from: old.description, to: new_.description };
  }
  if (old.date !== new_.date) {
    changes.date = { from: old.date, to: new_.date };
  }
  if (old.paidById !== new_.paidById) {
    changes.paidBy = {
      from: old.paidByDisplayName,
      to: new_.paidByDisplayName,
    };
  }

  const oldSet = new Set(oldParticipantIds);
  const newSet = new Set(newParticipantIds);
  const added = newParticipantIds
    .filter((id) => !oldSet.has(id))
    .map(resolveDisplayName);
  const removed = oldParticipantIds
    .filter((id) => !newSet.has(id))
    .map(resolveDisplayName);
  if (added.length > 0 || removed.length > 0) {
    changes.participants = { added, removed };
  }

  const oldSplitType = old.splitType ?? "equal";
  if (oldSplitType !== new_.splitType) {
    changes.splitType = { from: oldSplitType, to: new_.splitType };
  }

  return changes;
}

/**
 * Build a snapshot of split display names + amounts for activity log.
 * Used for splitsBefore/splitsAfter in expense edit payloads.
 */
export function buildSplitSnapshot(
  splits: Array<{ displayName: string; amountCents: number }>,
): Array<{ displayName: string; amountCents: number }> {
  return splits.map((s) => ({
    displayName: s.displayName,
    amountCents: s.amountCents,
  }));
}
