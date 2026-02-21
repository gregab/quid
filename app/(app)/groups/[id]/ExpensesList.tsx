"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AddExpenseForm } from "./AddExpenseForm";
import { ExpenseActions } from "./ExpenseActions";

export interface ExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  paidById: string;
  paidByDisplayName: string;
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
}: ExpensesListProps) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialExpenses);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

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
  }, []);

  const handleDeleteSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleOptimisticUpdate = useCallback((updated: ExpenseRow) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  const handleUpdateSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">Expenses</h2>
        <AddExpenseForm
          groupId={groupId}
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          onOptimisticAdd={handleOptimisticAdd}
          onSettled={handleAddSettled}
        />
      </div>

      {expenses.length === 0 ? (
        <p className="text-gray-400 text-sm">No expenses yet. Add one to get started.</p>
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
                  <p className="font-semibold text-sm text-gray-900 truncate">{expense.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Paid by {expense.paidByDisplayName} · {formatDate(expense.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-indigo-700 whitespace-nowrap">
                    {formatCents(expense.amountCents)}
                  </span>
                  {!expense.isPending && (
                    <ExpenseActions
                      groupId={groupId}
                      expense={{
                        id: expense.id,
                        description: expense.description,
                        amountCents: expense.amountCents,
                        date: expense.date,
                        paidById: expense.paidById,
                        paidByDisplayName: expense.paidByDisplayName,
                        canEdit: expense.canEdit,
                        canDelete: expense.canDelete,
                      }}
                      onOptimisticDelete={handleOptimisticDelete}
                      onDeleteFailed={handleDeleteFailed}
                      onDeleteSettled={handleDeleteSettled}
                      onOptimisticUpdate={handleOptimisticUpdate}
                      onUpdateSettled={handleUpdateSettled}
                    />
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
