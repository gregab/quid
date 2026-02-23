"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AddExpenseForm } from "./AddExpenseForm";
import { RecordPaymentForm } from "./RecordPaymentForm";
import { ExpenseActions } from "./ExpenseActions";
import type { ActivityLog } from "./ActivityFeed";
import { formatDisplayName } from "@/lib/formatDisplayName";
import type { MemberColor } from "./MemberPill";
import { splitAmount } from "@/lib/balances/splitAmount";

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
  canEdit: boolean;
  canDelete: boolean;
  isPending?: boolean;
  isPayment?: boolean;
  createdById?: string;
  createdAt?: string;
}

interface ExpensesListProps {
  groupId: string;
  groupCreatedById: string;
  currentUserId: string;
  currentUserDisplayName: string;
  initialExpenses: ExpenseRow[];
  members: Member[];
  allUserNames: Record<string, string>;
  onOptimisticActivity: (log: ActivityLog) => void;
  onExpensesChange?: (expenses: ExpenseRow[]) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  // Parse YYYY-MM-DD as local date to avoid UTC-shift issues
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  currentUserId: string,
  members: Member[]
): { label: string; amountCents: number; positive: boolean } | null {
  if (expense.isPayment) return null;

  const participantIds =
    expense.participantIds.length > 0
      ? expense.participantIds
      : members.map((m) => m.userId);

  const n = participantIds.length;
  if (n === 0) return null;

  const myIndex = participantIds.indexOf(currentUserId);
  const amIParticipant = myIndex !== -1;
  const amIPayer = expense.paidById === currentUserId;

  if (amIPayer) {
    const myShare = amIParticipant ? splitAmount(expense.amountCents, n)[myIndex]! : 0;
    const lentAmount = expense.amountCents - myShare;
    if (lentAmount <= 0) return null;
    return { label: "you lent", amountCents: lentAmount, positive: true };
  }

  if (amIParticipant) {
    const myShare = splitAmount(expense.amountCents, n)[myIndex]!;
    if (myShare <= 0) return null;
    return { label: "you owe", amountCents: myShare, positive: false };
  }

  return null;
}

export function ExpensesList({
  groupId,
  groupCreatedById,
  currentUserId,
  currentUserDisplayName,
  initialExpenses,
  members,
  allUserNames,
  onOptimisticActivity,
  onExpensesChange,
}: ExpensesListProps) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialExpenses);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

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
          {expenses.map((expense) => {
            const personalContext = getPersonalContext(expense, currentUserId, members);
            return (
              <li
                key={expense.id}
                className={removingIds.has(expense.id) ? "expense-item-exit" : "expense-item-enter"}
              >
                <Card
                  className={`px-4 py-3 flex items-center justify-between gap-4 ${
                    expense.isPending ? "opacity-60" : ""
                  }`}
                >
                  {expense.isPayment ? (
                    <>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-emerald-600 truncate dark:text-emerald-400">Payment</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-xs text-gray-400">
                            {getMemberPillProps(expense.paidById, members, allUserNames).name} → {getMemberPillProps(expense.participantIds[0]!, members, allUserNames).name} · {formatDate(expense.date)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-emerald-600 whitespace-nowrap dark:text-emerald-400">
                          {formatCents(expense.amountCents)}
                        </span>
                        <ExpenseActions
                          groupId={groupId}
                          expense={expense}
                          members={members}
                          isPending={expense.isPending}
                          currentUserDisplayName={currentUserDisplayName}
                          onOptimisticDelete={handleOptimisticDelete}
                          onDeleteFailed={handleDeleteFailed}
                          onDeleteSettled={handleDeleteSettled}
                          onOptimisticUpdate={handleOptimisticUpdate}
                          onUpdateSettled={handleUpdateSettled}
                          onOptimisticActivity={onOptimisticActivity}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate dark:text-gray-100">{expense.description}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-xs text-gray-400">
                            Paid by {getMemberPillProps(expense.paidById, members, allUserNames).name} · {formatDate(expense.date)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {(expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId))
                            .map((id) => getMemberPillProps(id, members, allUserNames).name)
                            .join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold text-indigo-700 whitespace-nowrap dark:text-indigo-400">
                            {formatCents(expense.amountCents)}
                          </span>
                          {personalContext && (
                            <span
                              className={`text-xs font-medium whitespace-nowrap ${
                                personalContext.positive
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-500 dark:text-rose-400"
                              }`}
                            >
                              {personalContext.label} {formatCents(personalContext.amountCents)}
                            </span>
                          )}
                        </div>
                        <ExpenseActions
                          groupId={groupId}
                          expense={expense}
                          members={members}
                          isPending={expense.isPending}
                          currentUserDisplayName={currentUserDisplayName}
                          onOptimisticDelete={handleOptimisticDelete}
                          onDeleteFailed={handleDeleteFailed}
                          onDeleteSettled={handleDeleteSettled}
                          onOptimisticUpdate={handleOptimisticUpdate}
                          onUpdateSettled={handleUpdateSettled}
                          onOptimisticActivity={onOptimisticActivity}
                        />
                      </div>
                    </>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}


    </section>
  );
}
