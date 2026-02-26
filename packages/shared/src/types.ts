/** A single expense or payment in a group. */
export interface ExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  paidById: string;
  paidByDisplayName: string;
  participantIds: string[];
  splits: Array<{ userId: string; amountCents: number }>;
  splitType: "equal" | "custom";
  canEdit: boolean;
  canDelete: boolean;
  isPending?: boolean;
  isPayment?: boolean;
  settledUp?: boolean;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string | null;
  recurringExpense?: {
    id: string;
    frequency: "weekly" | "monthly" | "yearly";
  } | null;
}

/** An entry in the group activity feed. */
export interface ActivityLog {
  id: string;
  action: string;
  payload: unknown;
  createdAt: Date | string;
  actor: { displayName: string };
  isPending?: boolean;
}

/** A debt the current user owes to another member. */
export interface UserOwesDebt {
  toId: string;
  toName: string;
  amountCents: number;
}

/** A single participant's share in an expense split. */
export type SplitEntry = { displayName: string; amountCents: number };

/** A resolved debt between two named members. */
export interface ResolvedDebt {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountCents: number;
}

/** Summary of a group for the dashboard. */
export interface GroupSummary {
  id: string;
  name: string;
  createdAt: string;
  patternSeed: string | null;
  bannerUrl: string | null;
  emoji: string | null;
  memberCount: number;
  balanceCents: number;
  isFriendGroup?: boolean;
  friendName?: string | null; // the other user's displayName, for friend groups
}

/** A contact (user from shared groups) available for friend expenses. */
export interface Contact {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}
