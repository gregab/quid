"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";
import { splitAmount } from "@/lib/balances/splitAmount";
import { formatCents } from "@/lib/format";
import { MAX_EXPENSE_DESCRIPTION } from "@/lib/constants";
import { filterDecimalInput } from "@/lib/amount";
import { percentagesToCents, centsToPercentages } from "@/lib/percentageSplit";

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
type SplitType = "equal" | "percentage" | "custom";


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

/** Strips non-numeric characters, allowing at most one decimal point and max 2 decimal places. */
/** Strips non-numeric characters, integers only, max 3 digits (for 0–100%). */
function filterIntegerInput(value: string): string {
  let filtered = "";
  for (const ch of value) {
    if (ch >= "0" && ch <= "9" && filtered.length < 3) filtered += ch;
  }
  return filtered;
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
  const router = useRouter();
  const [mode, setMode] = useState<ModalMode>("view");
  const [stopRecurringLoading, setStopRecurringLoading] = useState(false);
  const [stopRecurringError, setStopRecurringError] = useState<string | null>(null);
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
  const [editPercentages, setEditPercentages] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Source-of-truth for cent amounts — survives lossy percentage round-trips.
  const splitCentsRef = useRef<Map<string, number>>(
    new Map(expense.splits.map((s) => [s.userId, s.amountCents]))
  );
  const inputDirtyRef = useRef(false);

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

  const editPercentageSum = editSplitType === "percentage"
    ? [...editPercentages.values()].reduce((s, v) => s + (parseFloat(v || "0") || 0), 0)
    : 0;
  const editPercentageRemaining = editSplitType === "percentage" ? 100 - editPercentageSum : null;

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
        splitCentsRef.current = new Map(splitCentsRef.current);
        splitCentsRef.current.delete(userId);
        if (editSplitType === "custom") {
          setEditCustomAmounts((m) => { const n = new Map(m); n.delete(userId); return n; });
        } else if (editSplitType === "percentage") {
          setEditPercentages((m) => { const n = new Map(m); n.delete(userId); return n; });
        }
      } else {
        next.add(userId);
        splitCentsRef.current = new Map(splitCentsRef.current).set(userId, 0);
        if (editSplitType === "custom") {
          setEditCustomAmounts((m) => new Map(m).set(userId, "0.00"));
        } else if (editSplitType === "percentage") {
          setEditPercentages((m) => new Map(m).set(userId, "0"));
        }
      }
      return next;
    });
  }

  function handleEditSplitTypeChange(type: SplitType) {
    const ids = [...participantIds];

    // ── Leaving current mode: capture cents into splitCentsRef ──
    if (editSplitType === "equal" && ids.length > 0 && totalCentsValid) {
      const equal = splitAmount(parsedAmountCents, ids.length);
      const m = new Map<string, number>();
      ids.forEach((id, i) => m.set(id, equal[i]!));
      splitCentsRef.current = m;
    } else if (editSplitType === "custom") {
      const m = new Map<string, number>();
      ids.forEach((id) => m.set(id, Math.round(parseFloat(editCustomAmounts.get(id) ?? "0") * 100)));
      splitCentsRef.current = m;
    } else if (editSplitType === "percentage" && inputDirtyRef.current) {
      if (ids.length > 0 && totalCentsValid) {
        splitCentsRef.current = percentagesToCents(editPercentages, ids, parsedAmountCents);
      }
    }

    // ── Entering new mode: derive display from splitCentsRef ──
    if (type === "percentage") {
      if (ids.length > 0 && totalCentsValid && splitCentsRef.current.size > 0) {
        const dollarsMap = new Map<string, string>();
        ids.forEach((id) => dollarsMap.set(id, ((splitCentsRef.current.get(id) ?? 0) / 100).toFixed(2)));
        setEditPercentages(centsToPercentages(dollarsMap, ids, parsedAmountCents));
      } else {
        setEditPercentages(new Map(ids.map((id) => [id, "0"])));
      }
    } else if (type === "custom") {
      if (ids.length > 0 && totalCentsValid && splitCentsRef.current.size > 0) {
        const map = new Map<string, string>();
        ids.forEach((id) => map.set(id, ((splitCentsRef.current.get(id) ?? 0) / 100).toFixed(2)));
        setEditCustomAmounts(map);
      } else {
        const map = new Map<string, string>();
        ids.forEach((id) => map.set(id, "0.00"));
        setEditCustomAmounts(map);
      }
    }

    inputDirtyRef.current = false;
    setEditSplitType(type);
  }

  function handleAmountChange(newAmount: string) {
    setAmount(newAmount);
    const newCents = Math.round(parseFloat(newAmount) * 100);
    // Scale custom amounts when total changes in custom mode
    if (editSplitType === "custom") {
      if (!isNaN(newCents) && newCents > 0 && editCustomAmounts.size > 0) {
        const ids = [...participantIds];
        const scaled = scaleAmounts(editCustomAmounts, ids, editCustomSumCents, newCents);
        setEditCustomAmounts(scaled);
        // Sync ref
        const m = new Map<string, number>();
        ids.forEach((id) => m.set(id, Math.round(parseFloat(scaled.get(id) ?? "0") * 100)));
        splitCentsRef.current = m;
      }
    } else if (editSplitType === "percentage") {
      // Scale splitCentsRef proportionally so switching to custom later is accurate
      if (!isNaN(newCents) && newCents > 0 && splitCentsRef.current.size > 0) {
        const currentSum = [...splitCentsRef.current.values()].reduce((s, v) => s + v, 0);
        if (currentSum > 0 && currentSum !== newCents) {
          const ids = [...participantIds];
          const oldCents = ids.map((id) => splitCentsRef.current.get(id) ?? 0);
          const scaled = oldCents.map((a) => Math.floor((a * newCents) / currentSum));
          const remainder = newCents - scaled.reduce((s, a) => s + a, 0);
          const final = scaled.map((a, i) => a + (i < remainder ? 1 : 0));
          const m = new Map<string, number>();
          ids.forEach((id, i) => m.set(id, final[i]!));
          splitCentsRef.current = m;
        }
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
    const centsMap = new Map<string, number>();
    for (const s of expense.splits) {
      map.set(s.userId, (s.amountCents / 100).toFixed(2));
      centsMap.set(s.userId, s.amountCents);
    }
    setEditCustomAmounts(map);
    setEditPercentages(new Map());
    splitCentsRef.current = centsMap;
    inputDirtyRef.current = false;
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

    // Resolve percentage mode → custom cents
    let resolvedCustomAmounts = new Map(editCustomAmounts);
    let resolvedSplitType: "equal" | "custom" = editSplitType === "equal" ? "equal" : "custom";

    if (editSplitType === "percentage") {
      const centMap = percentagesToCents(editPercentages, submittedParticipantIds, amountCents);
      const sum = submittedParticipantIds.reduce((s, id) => s + (centMap.get(id) ?? 0), 0);
      if (sum !== amountCents) {
        setError(
          `Percentages must total 100%. Adjust amounts so they add up to $${(amountCents / 100).toFixed(2)}.`
        );
        return;
      }
      resolvedCustomAmounts = new Map(
        submittedParticipantIds.map((id) => [id, ((centMap.get(id) ?? 0) / 100).toFixed(2)])
      );
      resolvedSplitType = "custom";
    } else if (editSplitType === "custom") {
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
      resolvedSplitType === "custom"
        ? submittedParticipantIds.map((id) => ({
            userId: id,
            amountCents: Math.round(parseFloat(resolvedCustomAmounts.get(id) ?? "0") * 100),
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
      splitType: resolvedSplitType,
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
      splitType: resolvedSplitType,
    };
    if (resolvedSplitType === "custom") {
      body.customSplits = submittedParticipantIds.map((id) => ({
        userId: id,
        amountCents: Math.round(parseFloat(resolvedCustomAmounts.get(id) ?? "0") * 100),
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

  async function handleStopRecurring() {
    if (!expense.recurringExpense) return;
    setStopRecurringLoading(true);
    setStopRecurringError(null);
    const res = await fetch(`/api/groups/${groupId}/recurring/${expense.recurringExpense.id}`, {
      method: "DELETE",
    });
    setStopRecurringLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      setStopRecurringError(json.error ?? "Something went wrong. Please try again.");
      return;
    }
    onClose();
    router.refresh();
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
      <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-stone-800">
        {/* ── VIEW MODE ── */}
        {mode === "view" && (
          <>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-0.5">
                  {expense.isPayment ? "Payment" : "Expense"}
                </p>
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                  {expense.isPayment
                    ? `${payerName} → ${recipientName}`
                    : expense.description}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1 -mt-1 -mr-1 rounded-lg transition-colors"
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
                <span className="text-2xl font-bold text-stone-900 dark:text-white">
                  {formatCents(expense.amountCents)}
                </span>
                <span className="text-sm text-stone-400 dark:text-stone-500">
                  · {formatDisplayDate(expense.date)}
                </span>
              </div>
            ) : (
              /* Expense: just the date — amount lives in "Paid by" */
              <p className="text-sm text-stone-400 dark:text-stone-500 -mt-1 mb-4">
                {formatDisplayDate(expense.date)}
              </p>
            )}

            {!expense.isPayment && (
              /* Expense: visual breakdown */
              <div className="mb-5 space-y-4">
                {/* Paid by */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1.5">
                    Paid by
                  </p>
                  <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl px-3 py-2.5">
                    <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {payerName}{expense.paidById === currentUserId ? " (you)" : ""}
                    </span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                      {formatCents(expense.amountCents)}
                    </span>
                  </div>
                </div>

                {/* Per-person split with proportion bars */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1.5">
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
                              <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                                {name}{isYou ? " (you)" : ""}
                              </span>
                              {isPayer && (
                                <span className="shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full">
                                  paid
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 ml-3 shrink-0 tabular-nums">
                              {formatCents(share)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
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
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    {expense.isPayment ? "Recorded by" : "Added by"}{" "}
                    <span className="font-medium">{createdByName ?? "unknown"}</span>
                    {expense.createdAt && (
                      <> · {formatDateTime(expense.createdAt)}</>
                    )}
                  </p>
                )}
                {expense.updatedAt && (
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    Last edited · {formatDateTime(expense.updatedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Recurring metadata + stop button */}
            {expense.recurringExpense && (
              <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Recurring · {expense.recurringExpense.frequency}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStopRecurring}
                  disabled={stopRecurringLoading}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 transition-colors disabled:opacity-50"
                >
                  {stopRecurringLoading ? "Stopping…" : "Stop recurring"}
                </button>
              </div>
              {stopRecurringError && (
                <p className="px-3 pb-2.5 text-xs text-rose-600 dark:text-rose-400">
                  {stopRecurringError}
                </p>
              )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100 dark:border-stone-700">
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
                  maxLength={MAX_EXPENSE_DESCRIPTION}
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
              <div className="space-y-3">
                <p className="block text-sm font-medium text-stone-700 dark:text-stone-300">Split between</p>

                {/* Member checkboxes */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
                  {members.map((m) => {
                    const isChecked = participantIds.has(m.userId);
                    return (
                      <label key={m.userId} className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer">
                        <span
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? "bg-amber-500 border-amber-500"
                              : "border-stone-300 dark:border-stone-600"
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleParticipant(m.userId)}
                          className="sr-only"
                        />
                        <span className={`text-sm ${isChecked ? "text-stone-800 dark:text-stone-200" : "text-stone-400 dark:text-stone-500"}`}>{m.displayName}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Split type toggle */}
                {participantIds.size > 0 && (
                  <div className="grid grid-cols-3 rounded-xl bg-stone-100 dark:bg-stone-800 p-1 text-sm font-medium">
                    {(["equal", "percentage", "custom"] as SplitType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleEditSplitTypeChange(type)}
                        className={`py-2 rounded-lg transition-all ${
                          editSplitType === type
                            ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm"
                            : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        }`}
                      >
                        {type === "equal" ? "Equal" : type === "percentage" ? "Percent" : "Custom $"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Percentage inputs for edit mode */}
                {editSplitType === "percentage" && participantIds.size > 0 && (
                  <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
                    {orderedEditParticipants.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center gap-3 px-3.5 py-2.5"
                      >
                        <span className="text-sm text-stone-800 dark:text-stone-200 flex-1 truncate">
                          {m.displayName}
                          {m.userId === currentUserId && (
                            <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">(you)</span>
                          )}
                        </span>
                        <div className="w-20 flex items-center rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-800">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={editPercentages.get(m.userId) ?? "0"}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = filterIntegerInput(e.target.value);
                              inputDirtyRef.current = true;
                              setEditPercentages((prev) =>
                                new Map(prev).set(m.userId, val)
                              );
                            }}
                            className="w-full bg-transparent pl-2.5 pr-0.5 py-1.5 text-right text-base focus:outline-none text-stone-900 dark:text-stone-100"
                          />
                          <span className="pr-2 text-sm text-stone-400 dark:text-stone-500 select-none">%</span>
                        </div>
                      </div>
                    ))}
                    {editPercentageRemaining !== null && (
                      <div className="flex items-center justify-between px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/50">
                        <span className="text-xs text-stone-500 dark:text-stone-400">Total</span>
                        <span
                          className={`text-xs font-semibold ${
                            editPercentageRemaining === 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-500 dark:text-rose-400"
                          }`}
                        >
                          {editPercentageRemaining === 0
                            ? "100% ✓"
                            : editPercentageRemaining > 0
                            ? `${100 - editPercentageRemaining}% of 100%`
                            : `${100 - editPercentageRemaining}% — over by ${Math.abs(editPercentageRemaining)}%`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom amount inputs for edit mode */}
                {editSplitType === "custom" && participantIds.size > 0 && (
                  <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
                    {orderedEditParticipants.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center gap-3 px-3.5 py-2.5"
                      >
                        <span className="text-sm text-stone-800 dark:text-stone-200 flex-1 truncate">
                          {m.displayName}
                          {m.userId === currentUserId && (
                            <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">(you)</span>
                          )}
                        </span>
                        <div className="w-28 flex items-center rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-800">
                          <span className="pl-2.5 text-sm text-stone-400 dark:text-stone-500 select-none">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={editCustomAmounts.get(m.userId) ?? "0.00"}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = filterDecimalInput(e.target.value);
                              inputDirtyRef.current = true;
                              setEditCustomAmounts((prev) =>
                                new Map(prev).set(m.userId, val)
                              );
                            }}
                            className="w-full bg-transparent px-1.5 py-1.5 text-right text-base focus:outline-none text-stone-900 dark:text-stone-100"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Running total indicator */}
                    {totalCentsValid && editCustomRemaining !== null && (
                      <div className="flex items-center justify-between px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/50">
                        <span className="text-xs text-stone-500 dark:text-stone-400">Total</span>
                        <span
                          className={`text-xs font-semibold ${
                            editCustomRemaining === 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-500 dark:text-rose-400"
                          }`}
                        >
                          {editCustomRemaining === 0
                            ? `$${(parsedAmountCents / 100).toFixed(2)} ✓`
                            : editCustomRemaining > 0
                            ? `$${(editCustomSumCents / 100).toFixed(2)} of $${(parsedAmountCents / 100).toFixed(2)}`
                            : `$${(editCustomSumCents / 100).toFixed(2)} — over by $${(Math.abs(editCustomRemaining) / 100).toFixed(2)}`}
                        </span>
                      </div>
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
            <h2 className="text-lg font-bold text-stone-900 mb-1 dark:text-white">
              {expense.isPayment ? "Delete payment?" : "Delete expense?"}
            </h2>
            <p className="text-sm text-stone-500 mb-5 dark:text-stone-400">
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
