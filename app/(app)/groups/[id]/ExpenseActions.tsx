"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow } from "./ExpensesList";

interface ExpenseActionsProps {
  groupId: string;
  expense: ExpenseRow;
  onOptimisticDelete: (expenseId: string) => void;
  onDeleteFailed: (expense: ExpenseRow) => void;
  onDeleteSettled: () => void;
  onOptimisticUpdate: (expense: ExpenseRow) => void;
  onUpdateSettled: () => void;
}

export function ExpenseActions({
  groupId,
  expense,
  onOptimisticDelete,
  onDeleteFailed,
  onDeleteSettled,
  onOptimisticUpdate,
  onUpdateSettled,
}: ExpenseActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState((expense.amountCents / 100).toFixed(2));
  const [date, setDate] = useState(expense.date);
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  if (!expense.canEdit && !expense.canDelete) return null;

  const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);
    const updatedExpense: ExpenseRow = {
      ...expense,
      description,
      amountCents,
      date,
    };

    // Optimistically update
    setEditOpen(false);
    onOptimisticUpdate(updatedExpense);

    setEditLoading(true);
    const res = await fetch(`${basePath}/api/groups/${groupId}/expenses/${expense.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amountCents, date }),
    });

    const json = (await res.json()) as { data?: unknown; error?: string };
    setEditLoading(false);

    if (!res.ok || json.error) {
      // Revert optimistic update
      onOptimisticUpdate(expense);
      setEditOpen(true);
      setError(json.error ?? "Something went wrong.");
      return;
    }

    onUpdateSettled();
  }

  async function handleDelete() {
    setDeleteConfirm(false);
    // Optimistically remove
    onOptimisticDelete(expense.id);

    const res = await fetch(`${basePath}/api/groups/${groupId}/expenses/${expense.id}`, {
      method: "DELETE",
    });

    const json = (await res.json()) as { data?: unknown; error?: string };

    if (!res.ok || json.error) {
      onDeleteFailed(expense);
      return;
    }

    onDeleteSettled();
  }

  function handleEditClose() {
    setEditOpen(false);
    setDescription(expense.description);
    setAmount((expense.amountCents / 100).toFixed(2));
    setDate(expense.date);
    setError(null);
  }

  return (
    <>
      <div className="flex items-center gap-0.5 shrink-0">
        {expense.canEdit && (
          <button
            onClick={() => setEditOpen(true)}
            disabled={editLoading}
            className="text-gray-300 hover:text-indigo-500 p-1.5 rounded-lg transition-colors disabled:opacity-40"
            aria-label="Edit expense"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {expense.canDelete && (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg transition-colors"
            aria-label="Delete expense"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleEditClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit expense</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Input
                  id="editDescription"
                  type="text"
                  required
                  placeholder="e.g. Dinner, Uber, Groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="editAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount ($)
                </label>
                <Input
                  id="editAmount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="editDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <Input
                  id="editDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400">Splits will be recalculated equally among all current members.</p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" onClick={handleEditClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(false); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Delete expense?</h2>
            <p className="text-sm text-gray-500 mb-5">
              &ldquo;{expense.description}&rdquo; will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
