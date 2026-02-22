"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";

interface ExpenseActionsProps {
  groupId: string;
  expense: ExpenseRow;
  members: Member[];
  isPending?: boolean;
  currentUserDisplayName: string;
  onOptimisticDelete: (expenseId: string) => void;
  onDeleteFailed: (expense: ExpenseRow) => void;
  onDeleteSettled: () => void;
  onOptimisticUpdate: (expense: ExpenseRow) => void;
  onUpdateSettled: () => void;
  onOptimisticActivity: (log: ActivityLog) => void;
}

export function ExpenseActions({
  groupId,
  expense,
  members,
  isPending = false,
  currentUserDisplayName,
  onOptimisticDelete,
  onDeleteFailed,
  onDeleteSettled,
  onOptimisticUpdate,
  onUpdateSettled,
  onOptimisticActivity,
}: ExpenseActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState((expense.amountCents / 100).toFixed(2));
  const [date, setDate] = useState(expense.date);
  const [paidByUserId, setPaidByUserId] = useState(expense.paidById);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId))
  );
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  if (!expense.canEdit && !expense.canDelete) return null;

  const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;

  const parsedAmountCents = Math.round(parseFloat(amount) * 100);
  const originalParticipantIds = new Set(
    expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId)
  );
  const hasChanges =
    description !== expense.description ||
    (!isNaN(parsedAmountCents) && parsedAmountCents !== expense.amountCents) ||
    date !== expense.date ||
    paidByUserId !== expense.paidById ||
    participantIds.size !== originalParticipantIds.size ||
    [...participantIds].some((id) => !originalParticipantIds.has(id));

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (participantIds.size === 0) {
      setError("At least one participant must be selected.");
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);
    const paidByMember = members.find((m) => m.userId === paidByUserId);
    const updatedExpense: ExpenseRow = {
      ...expense,
      description,
      amountCents,
      date,
      paidById: paidByUserId,
      paidByDisplayName: paidByMember?.displayName ?? expense.paidByDisplayName,
      participantIds: [...participantIds],
    };

    const paidByDisplayName = paidByMember?.displayName ?? expense.paidByDisplayName;

    // Compute what changed for the optimistic activity log
    const changes: Record<string, unknown> = {};
    if (expense.amountCents !== amountCents) {
      changes.amount = { from: expense.amountCents, to: amountCents };
    }
    if (expense.description !== description) {
      changes.description = { from: expense.description, to: description };
    }
    if (expense.date !== date) {
      changes.date = { from: expense.date, to: date };
    }
    if (expense.paidById !== paidByUserId) {
      const oldPayer = members.find((m) => m.userId === expense.paidById)?.displayName ?? expense.paidByDisplayName;
      changes.paidBy = { from: oldPayer, to: paidByDisplayName };
    }
    const oldEffectiveIds = new Set(
      expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId)
    );
    const addedIds = [...participantIds].filter((id) => !oldEffectiveIds.has(id));
    const removedIds = [...oldEffectiveIds].filter((id) => !participantIds.has(id));
    if (addedIds.length > 0 || removedIds.length > 0) {
      changes.participants = {
        added: addedIds.map((id) => members.find((m) => m.userId === id)?.displayName ?? id),
        removed: removedIds.map((id) => members.find((m) => m.userId === id)?.displayName ?? id),
      };
    }

    // Optimistically update expense and activity log
    setEditOpen(false);
    onOptimisticUpdate(updatedExpense);
    onOptimisticActivity({
      id: `activity-pending-${Date.now()}`,
      action: "expense_edited",
      payload: { description, amountCents, paidByDisplayName, changes },
      createdAt: new Date(),
      actor: { displayName: currentUserDisplayName },
      isPending: true,
    });

    setEditLoading(true);
    const res = await fetch(`${basePath}/api/groups/${groupId}/expenses/${expense.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        amountCents,
        date,
        paidById: paidByUserId,
        participantIds: [...participantIds],
      }),
    });

    const json = (await res.json()) as { data?: unknown; error?: string };
    setEditLoading(false);

    if (!res.ok || json.error) {
      // Revert optimistic update and reconcile pending activity log via refresh
      onOptimisticUpdate(expense);
      setEditOpen(true);
      setError(json.error ?? "Something went wrong.");
      onUpdateSettled();
      return;
    }

    onUpdateSettled();
  }

  async function handleDelete() {
    setDeleteConfirm(false);
    // Optimistically remove expense and add activity log
    onOptimisticDelete(expense.id);
    onOptimisticActivity({
      id: `activity-pending-${Date.now()}`,
      action: "expense_deleted",
      payload: {
        description: expense.description,
        amountCents: expense.amountCents,
        paidByDisplayName: expense.paidByDisplayName,
      },
      createdAt: new Date(),
      actor: { displayName: currentUserDisplayName },
      isPending: true,
    });

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
    setPaidByUserId(expense.paidById);
    setParticipantIds(
      new Set(expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId))
    );
    setError(null);
  }

  return (
    <>
      <div className="flex items-center gap-0 shrink-0 -mr-1">
        {expense.canEdit && (
          <button
            onClick={() => setEditOpen(true)}
            disabled={isPending || editLoading}
            className="text-gray-300 hover:text-indigo-500 p-2.5 sm:p-1.5 rounded-lg transition-colors disabled:opacity-40"
            aria-label="Edit expense"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 sm:w-3.5 sm:h-3.5"
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
            disabled={isPending}
            className="text-gray-300 hover:text-red-500 p-2.5 sm:p-1.5 rounded-lg transition-colors disabled:opacity-40"
            aria-label="Delete expense"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 sm:w-3.5 sm:h-3.5"
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
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl overflow-hidden dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-white">Edit expense</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Description
                </label>
                <Input
                  id="editDescription"
                  type="text"
                  required
                  placeholder="e.g. Birdseed, Field Guide, Binoculars"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="editAmount" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
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
                <label htmlFor="editDate" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Date
                </label>
                <Input
                  id="editDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="appearance-none"
                />
              </div>
              <div>
                <label htmlFor="editPaidBy" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Paid by
                </label>
                <select
                  id="editPaidBy"
                  value={paidByUserId}
                  onChange={(e) => setPaidByUserId(e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Split between</p>
                <div className="space-y-1.5">
                  {members.map((m) => (
                    <label key={m.userId} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={participantIds.has(m.userId)}
                        onChange={() => toggleParticipant(m.userId)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{m.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" onClick={handleEditClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!hasChanges}>
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
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl overflow-hidden dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 mb-1 dark:text-white">Delete expense?</h2>
            <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">
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
