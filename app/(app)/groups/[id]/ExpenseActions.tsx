"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";
import { MAX_AMOUNT_CENTS, MAX_AMOUNT_DOLLARS, formatAmountDisplay, stripAmountFormatting } from "@/lib/amount";

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
  const [amountError, setAmountError] = useState(false);
  const [amountErrorMessage, setAmountErrorMessage] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // For payments: never show edit, only show delete (if canDelete)
  if (expense.isPayment) {
    if (!expense.canDelete) return null;
  } else if (!expense.canEdit && !expense.canDelete) {
    return null;
  }

  const parsedAmountCents = Math.round(parseFloat(stripAmountFormatting(amount)) * 100);
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

  function handleAmountBlur() {
    const num = parseFloat(stripAmountFormatting(amount));
    if (amount.trim() === "" || isNaN(num) || num <= 0) {
      setAmountError(true);
      setAmountErrorMessage("Please enter a valid amount greater than zero.");
    } else if (Math.round(num * 100) > MAX_AMOUNT_CENTS) {
      setAmountError(true);
      setAmountErrorMessage(`Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`);
    } else {
      setAmountError(false);
      setAmountErrorMessage(null);
      setAmount(formatAmountDisplay(amount));
    }
  }

  function handleAmountFocus() {
    setAmount(stripAmountFormatting(amount));
    setAmountError(false);
    setAmountErrorMessage(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(stripAmountFormatting(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountErrorMessage("Please enter a valid amount greater than zero.");
      setAmountError(true);
      return;
    }
    const amountCentsCheck = Math.round(parsedAmount * 100);
    if (amountCentsCheck > MAX_AMOUNT_CENTS) {
      setAmountErrorMessage(`Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`);
      setAmountError(true);
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
    const res = await fetch(`/api/groups/${groupId}/expenses/${expense.id}`, {
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
    if (expense.isPayment) {
      const recipientName = members.find((m) => m.userId === expense.participantIds[0])?.displayName ?? "Unknown";
      onOptimisticActivity({
        id: `activity-pending-${Date.now()}`,
        action: "payment_deleted",
        payload: {
          amountCents: expense.amountCents,
          fromDisplayName: expense.paidByDisplayName,
          toDisplayName: recipientName,
        },
        createdAt: new Date(),
        actor: { displayName: currentUserDisplayName },
        isPending: true,
      });
    } else {
      const splits = expense.splits.map((s) => ({
        displayName: members.find((m) => m.userId === s.userId)?.displayName ?? "Unknown",
        amountCents: s.amountCents,
      }));
      onOptimisticActivity({
        id: `activity-pending-${Date.now()}`,
        action: "expense_deleted",
        payload: {
          description: expense.description,
          amountCents: expense.amountCents,
          paidByDisplayName: expense.paidByDisplayName,
          splitType: expense.splitType,
          splits,
        },
        createdAt: new Date(),
        actor: { displayName: currentUserDisplayName },
        isPending: true,
      });
    }

    const res = await fetch(`/api/groups/${groupId}/expenses/${expense.id}`, {
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
    setAmountError(false);
    setAmountErrorMessage(null);
  }

  return (
    <>
      <div className="flex items-center gap-0 shrink-0 -mr-1">
        {!expense.isPayment && expense.canEdit && (
          <button
            onClick={() => setEditOpen(true)}
            disabled={isPending || editLoading}
            className="text-stone-300 hover:text-amber-500 p-2.5 sm:p-1.5 rounded-lg transition-colors disabled:opacity-40"
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
            className="text-stone-300 hover:text-red-500 p-2.5 sm:p-1.5 rounded-lg transition-colors disabled:opacity-40"
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
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleEditClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-stone-800">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">Edit expense</h2>
              <p className="text-sm text-stone-400 mt-0.5">Update the details below.</p>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label htmlFor="editDescription" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
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
                <label htmlFor="editAmount" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                  Amount ($)
                </label>
                <Input
                  id="editAmount"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={amount}
                  hasError={amountError}
                  onChange={(e) => { setAmount(e.target.value); setAmountError(false); setAmountErrorMessage(null); }}
                  onBlur={handleAmountBlur}
                  onFocus={handleAmountFocus}
                />
                {amountErrorMessage && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {amountErrorMessage}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="editDate" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
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
                <label htmlFor="editPaidBy" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                  Paid by
                </label>
                <select
                  id="editPaidBy"
                  value={paidByUserId}
                  onChange={(e) => setPaidByUserId(e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-stone-900 dark:border-stone-700 dark:text-stone-100"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="block text-sm font-medium text-stone-700 mb-2 dark:text-stone-300">Split between</p>
                <div className="space-y-1.5">
                  {members.map((m) => (
                    <label key={m.userId} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={participantIds.has(m.userId)}
                        onChange={() => toggleParticipant(m.userId)}
                        className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-stone-700 dark:text-stone-300">{m.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(false); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-stone-800">
            <h2 className="text-lg font-bold text-stone-900 mb-1 dark:text-white">
              {expense.isPayment ? "Delete payment?" : "Delete expense?"}
            </h2>
            <p className="text-sm text-stone-500 mb-5 dark:text-stone-400">
              {expense.isPayment
                ? "This payment will be permanently deleted and balances will be recalculated."
                : `"${expense.description}" will be permanently deleted.`}
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
