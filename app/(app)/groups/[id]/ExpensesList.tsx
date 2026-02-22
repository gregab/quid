"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AddExpenseForm } from "./AddExpenseForm";
import { ExpenseActions } from "./ExpenseActions";
import type { ActivityLog } from "./ActivityFeed";

export interface Member {
  userId: string;
  displayName: string;
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
}

interface ExpensesListProps {
  groupId: string;
  groupCreatedById: string;
  currentUserId: string;
  currentUserDisplayName: string;
  initialExpenses: ExpenseRow[];
  members: Member[];
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

export function ExpensesList({
  groupId,
  groupCreatedById,
  currentUserId,
  currentUserDisplayName,
  initialExpenses,
  members,
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
      return [...prev, expense].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
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
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
  }, []);

  const handleUpdateSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Expenses</h2>
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
        <p className="text-gray-400 text-sm">No expenses yet. Log the first forage.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className={removingIds.has(expense.id) ? "expense-item-exit" : "expense-item-enter"}
            >
              <Card
                className={`px-4 py-3 flex items-center justify-between gap-4 ${
                  expense.isPending ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate dark:text-gray-100">{expense.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Paid by {expense.paidByDisplayName} · {formatDate(expense.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-indigo-700 whitespace-nowrap dark:text-indigo-400">
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
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
