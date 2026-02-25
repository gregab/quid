/**
 * Builders for Supabase RPC call parameters.
 * Ensures both web and mobile construct identical payloads.
 */

import type { ExpenseChanges } from "./activityDiff";

interface MemberLike {
  userId: string;
  displayName: string;
}

// ── Create Expense ─────────────────────────────────────────────────

export interface CreateExpenseInput {
  groupId: string;
  description: string;
  amountCents: number;
  date: string;
  paidById: string;
  participantIds: string[];
  members: MemberLike[];
  splitType: "equal" | "custom";
  splitAmounts?: number[] | null;
  participantDisplayNames: string[];
}

export function buildCreateExpenseParams(input: CreateExpenseInput) {
  const paidByName =
    input.members.find((m) => m.userId === input.paidById)?.displayName ??
    "Unknown";
  return {
    _group_id: input.groupId,
    _description: input.description,
    _amount_cents: input.amountCents,
    _date: input.date,
    _paid_by_id: input.paidById,
    _participant_ids: input.participantIds,
    _paid_by_display_name: paidByName,
    _split_type: input.splitType,
    _split_amounts: input.splitAmounts ?? undefined,
    _participant_display_names: input.participantDisplayNames,
  };
}

// ── Create Recurring Expense ───────────────────────────────────────

export interface CreateRecurringExpenseInput extends CreateExpenseInput {
  frequency: "weekly" | "monthly" | "yearly";
}

export function buildCreateRecurringExpenseParams(
  input: CreateRecurringExpenseInput,
) {
  return {
    ...buildCreateExpenseParams(input),
    _frequency: input.frequency,
  };
}

// ── Update Expense ─────────────────────────────────────────────────

export interface UpdateExpenseInput {
  expenseId: string;
  groupId: string;
  description: string;
  amountCents: number;
  date: string;
  paidById: string;
  participantIds: string[];
  members: MemberLike[];
  splitType: "equal" | "custom";
  splitAmounts?: number[] | null;
  changes: ExpenseChanges;
  splitsBefore: Array<{ displayName: string; amountCents: number }>;
  splitsAfter: Array<{ displayName: string; amountCents: number }>;
}

export function buildUpdateExpenseParams(input: UpdateExpenseInput) {
  const paidByName =
    input.members.find((m) => m.userId === input.paidById)?.displayName ??
    "Unknown";
  return {
    _expense_id: input.expenseId,
    _group_id: input.groupId,
    _description: input.description,
    _amount_cents: input.amountCents,
    _date: input.date,
    _paid_by_id: input.paidById,
    _participant_ids: input.participantIds,
    _paid_by_display_name: paidByName,
    _changes: input.changes,
    _split_type: input.splitType,
    _split_amounts: input.splitAmounts ?? undefined,
    _splits_before: input.splitsBefore,
    _splits_after: input.splitsAfter,
  };
}

// ── Create Payment ─────────────────────────────────────────────────

export interface CreatePaymentInput {
  groupId: string;
  amountCents: number;
  date: string;
  paidById: string;
  recipientId: string;
  members: MemberLike[];
  settledUp?: boolean;
}

export function buildCreatePaymentParams(input: CreatePaymentInput) {
  const fromName =
    input.members.find((m) => m.userId === input.paidById)?.displayName ??
    "Unknown";
  const toName =
    input.members.find((m) => m.userId === input.recipientId)?.displayName ??
    "Unknown";
  return {
    _group_id: input.groupId,
    _amount_cents: input.amountCents,
    _date: input.date,
    _paid_by_id: input.paidById,
    _recipient_id: input.recipientId,
    _from_display_name: fromName,
    _to_display_name: toName,
    _settled_up: input.settledUp ?? false,
  };
}

// ── Delete Expense ─────────────────────────────────────────────────

export interface DeleteExpenseInput {
  expenseId: string;
  groupId: string;
  description: string;
  amountCents: number;
  paidByDisplayName: string;
  date: string;
  participantDisplayNames?: string[];
}

export function buildDeleteExpenseParams(input: DeleteExpenseInput) {
  return {
    _expense_id: input.expenseId,
    _group_id: input.groupId,
    _description: input.description,
    _amount_cents: input.amountCents,
    _paid_by_display_name: input.paidByDisplayName,
    _date: input.date,
    _participant_display_names: input.participantDisplayNames,
  };
}
