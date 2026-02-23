"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AddExpenseForm } from "./AddExpenseForm";
import { RecordPaymentForm, type UserOwesDebt } from "./RecordPaymentForm";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import type { ActivityLog } from "./ActivityFeed";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { formatCents } from "@/lib/format";
import type { MemberColor } from "./MemberPill";

export interface Member {
  userId: string;
  displayName: string;
  emoji?: string;
  color?: MemberColor;
}

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
}

interface ExpensesListProps {
  groupId: string;
  groupCreatedById: string;
  currentUserId: string;
  currentUserDisplayName: string;
  initialExpenses: ExpenseRow[];
  members: Member[];
  allUserNames: Record<string, string>;
  userOwesDebts: UserOwesDebt[];
  onOptimisticActivity: (log: ActivityLog) => void;
  onExpensesChange?: (expenses: ExpenseRow[]) => void;
}


function formatDateBlock(dateStr: string): { month: string; day: string } {
  // Parse YYYY-MM-DD as local date to avoid UTC-shift issues
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(day!),
  };
}

function getMemberPillProps(
  userId: string,
  members: Member[],
  allUserNames: Record<string, string>
): { name: string; emoji?: string; color?: MemberColor } {
  const member = members.find((m) => m.userId === userId);
  if (member) {
    return { name: formatDisplayName(member.displayName), emoji: member.emoji, color: member.color };
  }
  return { name: formatDisplayName(allUserNames[userId] ?? "Unknown") };
}

/**
 * Returns the current user's personal financial stake in this expense:
 * - "you lent $X" (green) when they paid and others owe them
 * - "you owe $X" (red) when someone else paid and they're a participant
 * - null when user isn't involved, or it's a payment (already settled semantics)
 */
function getPersonalContext(
  expense: ExpenseRow,
  currentUserId: string
): { label: string; amountCents: number; positive: boolean } | null {
  if (expense.isPayment) return null;

  const mySplit = expense.splits.find((s) => s.userId === currentUserId);
  const amIParticipant = mySplit !== undefined;
  const amIPayer = expense.paidById === currentUserId;

  if (amIPayer) {
    const myShare = mySplit?.amountCents ?? 0;
    const lentAmount = expense.amountCents - myShare;
    if (lentAmount <= 0) return null;
    return { label: "you lent", amountCents: lentAmount, positive: true };
  }

  if (amIParticipant) {
    const myShare = mySplit!.amountCents;
    if (myShare <= 0) return null;
    return { label: "you owe", amountCents: myShare, positive: false };
  }

  return null;
}

/**
 * Returns a human-readable payment direction line from the current user's perspective:
 * - "you paid [Name]" when the current user is the sender
 * - "[Name] paid you" when the current user is the receiver
 * - "[From] → [To]" otherwise
 */
function getPaymentDirection(
  expense: ExpenseRow,
  currentUserId: string,
  members: Member[],
  allUserNames: Record<string, string>
): string {
  const receiverId = expense.participantIds[0];
  const toName = receiverId ? getMemberPillProps(receiverId, members, allUserNames).name : "Unknown";
  const fromName = getMemberPillProps(expense.paidById, members, allUserNames).name;

  if (expense.paidById === currentUserId) return `you paid ${toName}`;
  if (receiverId === currentUserId) return `${fromName} paid you`;
  return `${fromName} → ${toName}`;
}

/**
 * Returns the "settled up with" title for a settled-up payment card.
 * Always uses display names (no "you" pronoun): "Alice settled up with Bob"
 */
export function getSettledUpTitle(
  expense: ExpenseRow,
  members: Member[],
  allUserNames: Record<string, string>
): string {
  const receiverId = expense.participantIds[0];
  const toName = receiverId ? getMemberPillProps(receiverId, members, allUserNames).name : "Unknown";
  const fromName = getMemberPillProps(expense.paidById, members, allUserNames).name;
  return `${fromName} settled up with ${toName}`;
}

export function ExpensesList({
  groupId,
  groupCreatedById,
  currentUserId,
  currentUserDisplayName,
  initialExpenses,
  members,
  allUserNames,
  userOwesDebts,
  onOptimisticActivity,
  onExpensesChange,
}: ExpensesListProps) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialExpenses);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [openDetailExpenseId, setOpenDetailExpenseId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(30);

  // When router.refresh() delivers fresh server data, replace any pending items.
  // useState(initialExpenses) only uses the prop as the initial value and ignores
  // subsequent changes, so we need this effect to reconcile optimistic ghosts.
  useEffect(() => {
    setExpenses((prev) => {
      if (!prev.some((e) => e.isPending)) return prev;
      return initialExpenses;
    });
  }, [initialExpenses]);

  // Notify parent when expenses change so it can recompute balances.
  useEffect(() => {
    onExpensesChange?.(expenses);
  }, [expenses, onExpensesChange]);

  const handleOptimisticAdd = useCallback((expense: ExpenseRow) => {
    setExpenses((prev) => [expense, ...prev]);
  }, []);

  const handleAddSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleOptimisticDelete = useCallback((expenseId: string) => {
    setRemovingIds((prev) => new Set(prev).add(expenseId));
    // Remove from list after exit animation
    setTimeout(() => {
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }, 200);
  }, []);

  const handleDeleteFailed = useCallback((expense: ExpenseRow) => {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.delete(expense.id);
      return next;
    });
    setExpenses((prev) => {
      // Only re-add if it was actually removed
      if (prev.some((e) => e.id === expense.id)) return prev;
      return [...prev, expense].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      });
    });
    // Refresh to reconcile any pending activity logs
    router.refresh();
  }, [router]);

  const handleDeleteSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleOptimisticUpdate = useCallback((updated: ExpenseRow) => {
    setExpenses((prev) =>
      prev
        .map((e) => (e.id === updated.id ? updated : e))
        .sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
        })
    );
  }, []);

  const handleUpdateSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Expenses</h2>
        {/* Desktop: buttons in header */}
        <div className="hidden sm:flex items-center gap-2">
          <RecordPaymentForm
            groupId={groupId}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            members={members}
            userOwesDebts={userOwesDebts}
            onOptimisticAdd={handleOptimisticAdd}
            onSettled={handleAddSettled}
            onOptimisticActivity={onOptimisticActivity}
          />
          <AddExpenseForm
            groupId={groupId}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            members={members}
            onOptimisticAdd={handleOptimisticAdd}
            onSettled={handleAddSettled}
            onOptimisticActivity={onOptimisticActivity}
          />
        </div>
      </div>

      {/* Mobile: buttons below heading, above list */}
      <div className="flex sm:hidden gap-2 mb-3">
        <RecordPaymentForm
          groupId={groupId}
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          members={members}
          userOwesDebts={userOwesDebts}
          onOptimisticAdd={handleOptimisticAdd}
          onSettled={handleAddSettled}
          onOptimisticActivity={onOptimisticActivity}
        />
        <AddExpenseForm
          groupId={groupId}
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          members={members}
          onOptimisticAdd={handleOptimisticAdd}
          onSettled={handleAddSettled}
          onOptimisticActivity={onOptimisticActivity}
        />
      </div>

      {expenses.length === 0 ? (
        <p className="text-gray-400 text-sm">No expenses yet. Add one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.slice(0, displayCount).map((expense) => {
            const personalContext = getPersonalContext(expense, currentUserId);
            const payerName = expense.paidById === currentUserId
              ? "you"
              : getMemberPillProps(expense.paidById, members, allUserNames).name;
            const payerLine = `${payerName} paid ${formatCents(expense.amountCents)}`;
            const paymentDirection = expense.isPayment
              ? getPaymentDirection(expense, currentUserId, members, allUserNames)
              : null;
            const dateParts = formatDateBlock(expense.date);

            const isSettledUp = expense.isPayment && expense.settledUp;

            // Left accent bar color
            const accentColor = isSettledUp
              ? "border-l-emerald-500"
              : expense.isPayment
                ? "border-l-indigo-400"
                : personalContext?.positive
                  ? "border-l-emerald-500"
                  : personalContext
                    ? "border-l-rose-400"
                    : "border-l-gray-200 dark:border-l-gray-700";

            // Payment row background tint
            const paymentBg = isSettledUp
              ? "bg-emerald-50/40 dark:bg-emerald-950/20"
              : expense.isPayment
                ? "bg-indigo-50/40 dark:bg-indigo-950/20"
                : "";

            return (
              <li
                key={expense.id}
                className={removingIds.has(expense.id) ? "expense-item-exit" : "expense-item-enter"}
              >
                <button
                  type="button"
                  className="w-full text-left rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  onClick={() => setOpenDetailExpenseId(expense.id)}
                >
                  <Card
                    className={`px-3 sm:px-4 py-3 border-l-[3px] ${accentColor} ${paymentBg} ${expense.isPending ? "opacity-60" : ""} hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Date block */}
                      <div className="flex flex-col items-center w-9 shrink-0 text-center">
                        <span className="text-[9px] font-bold tracking-wider text-gray-400 dark:text-gray-500 leading-none">
                          {dateParts.month}
                        </span>
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300 leading-tight mt-px">
                          {dateParts.day}
                        </span>
                      </div>

                      {/* Vertical divider */}
                      <div className="w-px h-7 bg-gray-200 dark:bg-gray-700 shrink-0" />

                      {/* Info: title + subtitle */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isSettledUp ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100"}`}>
                          {isSettledUp ? (
                            <>{getSettledUpTitle(expense, members, allUserNames)} ✨</>
                          ) : expense.isPayment ? (
                            <>{paymentDirection}</>
                          ) : expense.description}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {expense.isPayment ? `Payment · ${formatCents(expense.amountCents)}` : payerLine}
                        </p>
                      </div>

                      {/* Right: personal stake (expenses) or amount (payments) + chevron */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {expense.isPayment ? (
                          <span className={`text-base font-bold whitespace-nowrap ${isSettledUp ? "text-emerald-700 dark:text-emerald-400" : "text-indigo-700 dark:text-indigo-400"}`}>
                            {formatCents(expense.amountCents)}
                          </span>
                        ) : personalContext ? (
                          <div className="text-right">
                            <p className={`text-xs leading-none ${
                              personalContext.positive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-500 dark:text-rose-400"
                            }`}>
                              {personalContext.label}
                            </p>
                            <p className={`text-base font-bold leading-tight mt-px whitespace-nowrap ${
                              personalContext.positive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-500 dark:text-rose-400"
                            }`}>
                              {formatCents(personalContext.amountCents)}
                            </p>
                          </div>
                        ) : null}
                        <svg
                          className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {expenses.length > displayCount && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setDisplayCount((c) => c + 30)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium transition-colors"
          >
            Show {Math.min(expenses.length - displayCount, 30)} more
          </button>
        </div>
      )}

      {/* Detail / edit modal — rendered once at list level */}
      {openDetailExpenseId && (() => {
        const expense = expenses.find((e) => e.id === openDetailExpenseId);
        if (!expense) return null;
        return (
          <ExpenseDetailModal
            groupId={groupId}
            expense={expense}
            members={members}
            allUserNames={allUserNames}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            onClose={() => setOpenDetailExpenseId(null)}
            onOptimisticDelete={handleOptimisticDelete}
            onDeleteFailed={handleDeleteFailed}
            onDeleteSettled={handleDeleteSettled}
            onOptimisticUpdate={handleOptimisticUpdate}
            onUpdateSettled={handleUpdateSettled}
            onOptimisticActivity={onOptimisticActivity}
          />
        );
      })()}
    </section>
  );
}
