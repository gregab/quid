"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";
import { splitAmount } from "@/lib/balances/splitAmount";
import { formatCents } from "@/lib/format";

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
type SplitType = "equal" | "custom";


function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateTime(isoStr: string): string {
  const date = new Date(isoStr);
  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

/**
 * Scales existing custom amounts proportionally when the total changes.
 * Uses integer math with remainder distribution to avoid float drift.
 */
function scaleAmounts(
  amounts: Map<string, string>,
  participantIds: string[],
  oldTotalCents: number,
  newTotalCents: number
): Map<string, string> {
  if (oldTotalCents <= 0 || participantIds.length === 0) return amounts;
  const ids = participantIds.filter((id) => amounts.has(id));
  const oldCents = ids.map((id) => Math.round(parseFloat(amounts.get(id) ?? "0") * 100));
  const scaled = oldCents.map((a) => Math.floor((a * newTotalCents) / oldTotalCents));
  const remainder = newTotalCents - scaled.reduce((s, a) => s + a, 0);
  const final = scaled.map((a, i) => a + (i < remainder ? 1 : 0));
  const result = new Map(amounts);
  ids.forEach((id, i) => result.set(id, (final[i]! / 100).toFixed(2)));
  return result;
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
  const [editSplitType, setEditSplitType] = useState<SplitType>(expense.splitType);
  const [editCustomAmounts, setEditCustomAmounts] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const s of expense.splits) {
      map.set(s.userId, (s.amountCents / 100).toFixed(2));
    }
    return map;
  });
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const parsedAmountCents = Math.round(parseFloat(amount) * 100);
  const totalCentsValid = !isNaN(parsedAmountCents) && parsedAmountCents > 0;

  const originalParticipantIds = new Set(
    expense.participantIds.length > 0 ? expense.participantIds : members.map((m) => m.userId)
  );

  // Custom split sum for edit mode
  const editCustomSumCents =
    editSplitType === "custom"
      ? [...editCustomAmounts.values()].reduce(
          (s, v) => s + Math.round(parseFloat(v || "0") * 100),
          0
        )
      : 0;
  const editCustomRemaining = totalCentsValid ? parsedAmountCents - editCustomSumCents : null;

  const hasChanges =
    description !== expense.description ||
    (!isNaN(parsedAmountCents) && parsedAmountCents !== expense.amountCents) ||
    date !== expense.date ||
    paidByUserId !== expense.paidById ||
    participantIds.size !== originalParticipantIds.size ||
    [...participantIds].some((id) => !originalParticipantIds.has(id)) ||
    editSplitType !== expense.splitType ||
    (editSplitType === "custom" &&
      [...participantIds].some((id) => {
        const stored = expense.splits.find((s) => s.userId === id)?.amountCents ?? 0;
        const current = Math.round(parseFloat(editCustomAmounts.get(id) ?? "0") * 100);
        return stored !== current;
      }));

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        if (editSplitType === "custom") {
          setEditCustomAmounts((m) => {
            const n = new Map(m);
            n.delete(userId);
            return n;
          });
        }
      } else {
        next.add(userId);
        if (editSplitType === "custom") {
          setEditCustomAmounts((m) => new Map(m).set(userId, "0.00"));
        }
      }
      return next;
    });
  }

  function handleEditSplitTypeChange(type: SplitType) {
    if (type === "custom" && editSplitType === "equal") {
      const ids = [...participantIds];
      if (ids.length > 0 && totalCentsValid) {
        const equal = splitAmount(parsedAmountCents, ids.length);
        const map = new Map<string, string>();
        ids.forEach((id, i) => map.set(id, (equal[i]! / 100).toFixed(2)));
        setEditCustomAmounts(map);
      } else {
        const map = new Map<string, string>();
        [...participantIds].forEach((id) => map.set(id, "0.00"));
        setEditCustomAmounts(map);
      }
    }
    setEditSplitType(type);
  }

  function handleAmountChange(newAmount: string) {
    setAmount(newAmount);
    // Scale custom amounts when total changes in custom mode
    if (editSplitType === "custom") {
      const newCents = Math.round(parseFloat(newAmount) * 100);
      if (!isNaN(newCents) && newCents > 0 && editCustomAmounts.size > 0) {
        setEditCustomAmounts((prev) =>
          scaleAmounts(prev, [...participantIds], editCustomSumCents, newCents)
        );
      }
    }
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
    setEditSplitType(expense.splitType);
    const map = new Map<string, string>();
    for (const s of expense.splits) {
      map.set(s.userId, (s.amountCents / 100).toFixed(2));
    }
    setEditCustomAmounts(map);
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
    const submittedParticipantIds = [...participantIds];

    if (editSplitType === "custom") {
      const sum = submittedParticipantIds.reduce(
        (s, id) => s + Math.round(parseFloat(editCustomAmounts.get(id) ?? "0") * 100),
        0
      );
      if (sum !== amountCents) {
        setError(
          `Custom amounts must sum to $${(amountCents / 100).toFixed(2)}. Current sum: $${(sum / 100).toFixed(2)}.`
        );
        return;
      }
    }

    const paidByMember = members.find((m) => m.userId === paidByUserId);
    const paidByDisplayName = paidByMember?.displayName ?? expense.paidByDisplayName;

    // Build splits for optimistic update
    const updatedSplits =
      editSplitType === "custom"
        ? submittedParticipantIds.map((id) => ({
            userId: id,
            amountCents: Math.round(parseFloat(editCustomAmounts.get(id) ?? "0") * 100),
          }))
        : splitAmount(amountCents, submittedParticipantIds.length).map((amt, i) => ({
            userId: submittedParticipantIds[i]!,
            amountCents: amt,
          }));

    const updatedExpense: ExpenseRow = {
      ...expense,
      description,
      amountCents,
      date,
      paidById: paidByUserId,
      paidByDisplayName,
      participantIds: submittedParticipantIds,
      splits: updatedSplits,
      splitType: editSplitType,
      updatedAt: new Date().toISOString(),
    };

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
    if (editSplitType !== expense.splitType) {
      changes.splitType = { from: expense.splitType, to: editSplitType };
    }

    // Apply optimistic update immediately (before API)
    onOptimisticUpdate(updatedExpense);
    onOptimisticActivity({
      id: `activity-pending-${Date.now()}`,
      action: "expense_edited",
      payload: { description, amountCents, date, paidByDisplayName, changes },
      createdAt: new Date(),
      actor: { displayName: currentUserDisplayName },
      isPending: true,
    });

    setEditLoading(true);

    const body: Record<string, unknown> = {
      description,
      amountCents,
      date,
      paidById: paidByUserId,
      participantIds: submittedParticipantIds,
      splitType: editSplitType,
    };
    if (editSplitType === "custom") {
      body.customSplits = submittedParticipantIds.map((id) => ({
        userId: id,
        amountCents: Math.round(parseFloat(editCustomAmounts.get(id) ?? "0") * 100),
      }));
    }

    const res = await fetch(`/api/groups/${groupId}/expenses/${expense.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
          date: expense.date,
          fromDisplayName: expense.paidByDisplayName,
          toDisplayName: recipientName,
        },
        createdAt: new Date(),
        actor: { displayName: currentUserDisplayName },
        isPending: true,
      });
    } else {
      const participantDisplayNames =
        expense.participantIds.length > 0
          ? expense.participantIds.map(
              (id) => members.find((m) => m.userId === id)?.displayName ?? id
            )
          : members.map((m) => m.displayName);
      onOptimisticActivity({
        id: `activity-pending-${Date.now()}`,
        action: "expense_deleted",
        payload: {
          description: expense.description,
          amountCents: expense.amountCents,
          date: expense.date,
          paidByDisplayName: expense.paidByDisplayName,
          participantDisplayNames,
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

  // View-mode display data — use stored splits directly
  const splitsForDisplay =
    expense.splits.length > 0
      ? expense.splits
      : members.map((m, i) => ({
          userId: m.userId,
          amountCents: splitAmount(expense.amountCents, members.length)[i]!,
        }));
  const payerName = allUserNames[expense.paidById] ?? expense.paidByDisplayName;
  const recipientId = expense.participantIds[0];
  const recipientName = recipientId ? (allUserNames[recipientId] ?? "Unknown") : "Unknown";

  const createdByName = expense.createdById
    ? expense.createdById === currentUserId
      ? "you"
      : (allUserNames[expense.createdById] ?? "a former member")
    : null;

  const orderedEditParticipants = members.filter((m) => participantIds.has(m.userId));

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
            <div className="flex items-start justify-between mb-3">
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

            {expense.isPayment ? (
              /* Payment: amount + date, names already in title */
              <div className="flex items-baseline gap-1.5 mb-5">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCents(expense.amountCents)}
                </span>
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  · {formatDisplayDate(expense.date)}
                </span>
              </div>
            ) : (
              /* Expense: just the date — amount lives in "Paid by" */
              <p className="text-sm text-gray-400 dark:text-gray-500 -mt-1 mb-4">
                {formatDisplayDate(expense.date)}
              </p>
            )}

            {!expense.isPayment && (
              /* Expense: visual breakdown */
              <div className="mb-5 space-y-4">
                {/* Paid by */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                    Paid by
                  </p>
                  <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl px-3 py-2.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {payerName}{expense.paidById === currentUserId ? " (you)" : ""}
                    </span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                      {formatCents(expense.amountCents)}
                    </span>
                  </div>
                </div>

                {/* Per-person split with proportion bars */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                    Split{expense.splitType === "custom" ? " · custom" : ""}
                  </p>
                  <div className="space-y-2.5">
                    {splitsForDisplay.map((split) => {
                      const id = split.userId;
                      const share = split.amountCents;
                      const name = allUserNames[id] ?? "Unknown";
                      const isYou = id === currentUserId;
                      const isPayer = id === expense.paidById;
                      const widthPct =
                        expense.amountCents > 0 ? (share / expense.amountCents) * 100 : 0;
                      return (
                        <div key={id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {name}{isYou ? " (you)" : ""}
                              </span>
                              {isPayer && (
                                <span className="shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full">
                                  paid
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 ml-3 shrink-0 tabular-nums">
                              {formatCents(share)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-400 dark:bg-indigo-500"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {(createdByName || expense.createdAt || expense.updatedAt) && (
              <div className="space-y-0.5 mb-4">
                {(createdByName || expense.createdAt) && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {expense.isPayment ? "Recorded by" : "Added by"}{" "}
                    <span className="font-medium">{createdByName ?? "unknown"}</span>
                    {expense.createdAt && (
                      <> · {formatDateTime(expense.createdAt)}</>
                    )}
                  </p>
                )}
                {expense.updatedAt && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Last edited · {formatDateTime(expense.updatedAt)}
                  </p>
                )}
              </div>
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
                  onChange={(e) => handleAmountChange(e.target.value)}
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

                {/* Split type toggle */}
                {participantIds.size > 0 && (
                  <div className="mt-3">
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => handleEditSplitTypeChange("equal")}
                        className={`px-3 py-1.5 transition-colors ${
                          editSplitType === "equal"
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        Equal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSplitTypeChange("custom")}
                        className={`px-3 py-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${
                          editSplitType === "custom"
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom amount inputs for edit mode */}
                {editSplitType === "custom" && participantIds.size > 0 && (
                  <div className="mt-3 space-y-2">
                    {orderedEditParticipants.map((m) => (
                      <div key={m.userId} className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                          {m.displayName}
                          {m.userId === currentUserId && (
                            <span className="ml-1 text-xs text-gray-400">(you)</span>
                          )}
                        </span>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={editCustomAmounts.get(m.userId) ?? "0.00"}
                            onChange={(e) =>
                              setEditCustomAmounts((prev) =>
                                new Map(prev).set(m.userId, e.target.value)
                              )
                            }
                            className="text-right text-sm py-1"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Running total indicator */}
                    {totalCentsValid && editCustomRemaining !== null && (
                      <p
                        className={`text-xs font-medium text-right ${
                          editCustomRemaining === 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {editCustomRemaining === 0
                          ? "Amounts add up ✓"
                          : editCustomRemaining > 0
                          ? `Remaining: $${(editCustomRemaining / 100).toFixed(2)}`
                          : `Over by: $${(Math.abs(editCustomRemaining) / 100).toFixed(2)}`}
                      </p>
                    )}
                  </div>
                )}
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
