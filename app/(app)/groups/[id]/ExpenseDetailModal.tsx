"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";

interface ExpenseDetailModalProps {
  groupId: string;
  expense: ExpenseRow;
  members: Member[];
  allUserNames: Record<string, string>;
  currentUserId: string;
  currentUserDisplayName: string;
  onClose: () => void;
  onOptimisticDelete: (expenseId: string) => void;
  onDeleteFailed: (expense: ExpenseRow) => void;
  onDeleteSettled: () => void;
  onOptimisticUpdate: (expense: ExpenseRow) => void;
  onUpdateSettled: () => void;
  onOptimisticActivity: (log: ActivityLog) => void;
}

type ModalMode = "view" | "edit" | "delete-confirm";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function ExpenseDetailModal({
  groupId,
  expense,
  members,
  allUserNames,
  currentUserId,
  currentUserDisplayName,
  onClose,
  onOptimisticDelete,
  onDeleteFailed,
  onDeleteSettled,
  onOptimisticUpdate,
  onUpdateSettled,
  onOptimisticActivity,
}: ExpenseDetailModalProps) {
  const [mode, setMode] = useState<ModalMode>("view");
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState((expense.amountCents / 100).toFixed(2));
  const [date, setDate] = useState(expense.date);
  const [paidByUserId, setPaidByUserId] = useState(expense.paidById);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId))
  );
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary").pathname;

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
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleCancelEdit() {
    setMode("view");
    setDescription(expense.description);
    setAmount((expense.amountCents / 100).toFixed(2));
    setDate(expense.date);
    setPaidByUserId(expense.paidById);
    setParticipantIds(
      new Set(expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId))
    );
    setError(null);
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

    // Compute changes for the optimistic activity log
    const changes: Record<string, unknown> = {};
    if (expense.amountCents !== amountCents) changes.amount = { from: expense.amountCents, to: amountCents };
    if (expense.description !== description) changes.description = { from: expense.description, to: description };
    if (expense.date !== date) changes.date = { from: expense.date, to: date };
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

    // Apply optimistic update immediately (before API)
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
      // Revert optimistic update; stay in edit mode so user can retry
      onOptimisticUpdate(expense);
      setError(json.error ?? "Something went wrong.");
      onUpdateSettled();
      return;
    }

    onClose();
    onUpdateSettled();
  }

  async function handleDelete() {
    onClose();
    onOptimisticDelete(expense.id);
    if (expense.isPayment) {
      const recipientName =
        members.find((m) => m.userId === expense.participantIds[0])?.displayName ?? "Unknown";
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
    }

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

  // View-mode display data
  const participantDisplayIds =
    expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId);
  const participantNames = participantDisplayIds.map((id) => allUserNames[id] ?? "Unknown");
  const payerName = allUserNames[expense.paidById] ?? expense.paidByDisplayName;
  const recipientId = expense.participantIds[0];
  const recipientName = recipientId ? (allUserNames[recipientId] ?? "Unknown") : "Unknown";

  const showCreatedBy = !!(expense.createdById && expense.createdById !== currentUserId);
  const createdByName = expense.createdById ? (allUserNames[expense.createdById] ?? "a former member") : null;

  return (
    <div
      className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-gray-800">
        {/* ── VIEW MODE ── */}
        {mode === "view" && (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
                  {expense.isPayment ? "Payment" : "Expense"}
                </p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {expense.isPayment
                    ? `${payerName} → ${recipientName}`
                    : expense.description}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -mt-1 -mr-1 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <dl className="space-y-2.5 text-sm mb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
                <dd className="font-semibold text-gray-900 dark:text-gray-100">{formatCents(expense.amountCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Date</dt>
                <dd className="text-gray-900 dark:text-gray-100">{formatDisplayDate(expense.date)}</dd>
              </div>
              {expense.isPayment ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">From</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {payerName}{expense.paidById === currentUserId ? " (you)" : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">To</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {recipientName}{recipientId === currentUserId ? " (you)" : ""}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Paid by</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {payerName}{expense.paidById === currentUserId ? " (you)" : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400 shrink-0">Split with</dt>
                    <dd className="text-gray-900 dark:text-gray-100 text-right">
                      {participantNames.join(", ")}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {showCreatedBy && createdByName && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                {expense.isPayment ? "Recorded by" : "Added by"} {createdByName}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              {expense.canDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setMode("delete-confirm")}
                  disabled={expense.isPending}
                  aria-label="Delete expense"
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Close
                </Button>
                {expense.canEdit && (
                  <Button
                    type="button"
                    onClick={() => setMode("edit")}
                    disabled={expense.isPending}
                    aria-label="Edit expense"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── EDIT MODE ── */}
        {mode === "edit" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit expense</h2>
              <p className="text-sm text-gray-400 mt-0.5">Update the details below.</p>
            </div>
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
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
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
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!hasChanges || editLoading}>
                  Save changes
                </Button>
              </div>
            </form>
          </>
        )}

        {/* ── DELETE CONFIRM MODE ── */}
        {mode === "delete-confirm" && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1 dark:text-white">
              {expense.isPayment ? "Delete payment?" : "Delete expense?"}
            </h2>
            <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">
              {expense.isPayment
                ? "This payment will be permanently deleted and balances will be recalculated."
                : `"${expense.description}" will be permanently deleted.`}
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setMode("view")}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
