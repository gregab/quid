"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";
import { splitAmount } from "@/lib/balances/splitAmount";
import { MAX_AMOUNT_CENTS, MAX_AMOUNT_DOLLARS, formatAmountDisplay, stripAmountFormatting } from "@/lib/amount";
import { percentagesToCents, centsToPercentages } from "@/lib/percentageSplit";

interface AddExpenseFormProps {
  groupId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  members: Member[];
  onOptimisticAdd: (expense: ExpenseRow) => void;
  onSettled: () => void;
  onOptimisticActivity: (log: ActivityLog) => void;
}

type SplitType = "equal" | "percentage" | "custom";

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

export function AddExpenseForm({
  groupId,
  currentUserId,
  currentUserDisplayName,
  members,
  onOptimisticAdd,
  onSettled,
  onOptimisticActivity,
}: AddExpenseFormProps) {
  const allMemberIds = members.map((m) => m.userId);

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set(allMemberIds));
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customAmounts, setCustomAmounts] = useState<Map<string, string>>(new Map());
  const [percentages, setPercentages] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState(false);
  const [amountErrorMessage, setAmountErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parsedTotalCents = Math.round(parseFloat(stripAmountFormatting(amount)) * 100);
  const totalCentsValid = !isNaN(parsedTotalCents) && parsedTotalCents > 0 && parsedTotalCents <= MAX_AMOUNT_CENTS;

  function handleSplitTypeChange(type: SplitType) {
    const ids = [...participantIds];
    if (type === "percentage" && splitType === "equal") {
      // Prefill equal percentages
      const equalPct = ids.length > 0 ? (100 / ids.length).toFixed(2) : "0.00";
      const map = new Map<string, string>();
      ids.forEach((id) => map.set(id, equalPct));
      setPercentages(map);
    } else if (type === "percentage" && splitType === "custom") {
      // Derive percentages from current dollar amounts
      setPercentages(centsToPercentages(customAmounts, ids, parsedTotalCents));
    } else if (type === "custom" && splitType === "equal") {
      // Prefill equal dollar amounts
      if (ids.length > 0 && totalCentsValid) {
        const equal = splitAmount(parsedTotalCents, ids.length);
        const map = new Map<string, string>();
        ids.forEach((id, i) => map.set(id, (equal[i]! / 100).toFixed(2)));
        setCustomAmounts(map);
      } else {
        const map = new Map<string, string>();
        ids.forEach((id) => map.set(id, "0.00"));
        setCustomAmounts(map);
      }
    } else if (type === "custom" && splitType === "percentage") {
      // Derive dollars from current percentages
      if (ids.length > 0 && totalCentsValid) {
        const centMap = percentagesToCents(percentages, ids, parsedTotalCents);
        const map = new Map<string, string>();
        ids.forEach((id) => map.set(id, ((centMap.get(id) ?? 0) / 100).toFixed(2)));
        setCustomAmounts(map);
      } else {
        const map = new Map<string, string>();
        ids.forEach((id) => map.set(id, "0.00"));
        setCustomAmounts(map);
      }
    }
    setSplitType(type);
  }

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        if (splitType === "custom") {
          setCustomAmounts((m) => { const n = new Map(m); n.delete(userId); return n; });
        } else if (splitType === "percentage") {
          setPercentages((m) => { const n = new Map(m); n.delete(userId); return n; });
        }
      } else {
        next.add(userId);
        if (splitType === "custom") {
          setCustomAmounts((m) => new Map(m).set(userId, "0.00"));
        } else if (splitType === "percentage") {
          setPercentages((m) => new Map(m).set(userId, "0.00"));
        }
      }
      return next;
    });
  }

  // Scale custom amounts when total changes (percentage inputs stay fixed, dollar outputs update automatically)
  useEffect(() => {
    if (splitType !== "custom" || !totalCentsValid) return;
    if (customAmounts.size === 0) return;
    const currentSum = [...customAmounts.values()].reduce(
      (s, v) => s + Math.round(parseFloat(v || "0") * 100),
      0
    );
    if (currentSum === parsedTotalCents) return;
    setCustomAmounts((prev) =>
      scaleAmounts(prev, [...participantIds], currentSum, parsedTotalCents)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedTotalCents]);

  const customSumCents =
    splitType === "custom"
      ? [...customAmounts.values()].reduce(
          (s, v) => s + Math.round(parseFloat(v || "0") * 100),
          0
        )
      : 0;
  const customRemaining = totalCentsValid ? parsedTotalCents - customSumCents : null;

  const percentageSum = splitType === "percentage"
    ? [...percentages.values()].reduce((s, v) => s + (parseFloat(v || "0") || 0), 0)
    : 0;
  const percentageRemaining = splitType === "percentage" ? 100 - percentageSum : null;

  function validateAmount(raw: string): string | null {
    const num = parseFloat(stripAmountFormatting(raw));
    if (raw.trim() === "" || isNaN(num) || num <= 0) return "Please enter a valid amount greater than zero.";
    if (Math.round(num * 100) > MAX_AMOUNT_CENTS) return `Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`;
    return null;
  }

  function handleAmountBlur() {
    const msg = validateAmount(amount);
    if (msg) {
      setAmountError(true);
      setAmountErrorMessage(msg);
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

  async function handleSubmit(e: React.FormEvent) {
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
    const submittedParticipantIds = [...participantIds];

    // For percentage mode: convert to cents, validate sum, treat as custom
    let resolvedCustomAmounts = new Map(customAmounts);
    let resolvedSplitType: "equal" | "custom" = splitType === "equal" ? "equal" : "custom";

    if (splitType === "percentage") {
      const centMap = percentagesToCents(percentages, submittedParticipantIds, amountCents);
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
    } else if (splitType === "custom") {
      const sum = submittedParticipantIds.reduce(
        (s, id) => s + Math.round(parseFloat(customAmounts.get(id) ?? "0") * 100),
        0
      );
      if (sum !== amountCents) {
        setError(
          `Custom amounts must sum to $${(amountCents / 100).toFixed(2)}. Current sum: $${(sum / 100).toFixed(2)}.`
        );
        return;
      }
    }

    const submittedDescription = description;
    const submittedDate = date;
    const submittedPaidByUserId = paidByUserId;
    const submittedSplitType = resolvedSplitType;
    const submittedCustomAmounts = resolvedCustomAmounts;

    const paidByMember = members.find((m) => m.userId === submittedPaidByUserId);
    const paidByDisplayName = paidByMember?.displayName ?? currentUserDisplayName;

    // Build splits for optimistic row
    const optimisticSplits =
      submittedSplitType === "custom"
        ? submittedParticipantIds.map((id) => ({
            userId: id,
            amountCents: Math.round(parseFloat(submittedCustomAmounts.get(id) ?? "0") * 100),
          }))
        : splitAmount(amountCents, submittedParticipantIds.length).map((amt, i) => ({
            userId: submittedParticipantIds[i]!,
            amountCents: amt,
          }));

    // Close modal and clear form immediately (optimistic)
    setOpen(false);
    resetForm();

    // Add optimistic expense to the list
    const pendingId = `pending-${Date.now()}`;
    onOptimisticAdd({
      id: pendingId,
      description: submittedDescription,
      amountCents,
      date: submittedDate,
      paidById: submittedPaidByUserId,
      paidByDisplayName,
      participantIds: submittedParticipantIds,
      splits: optimisticSplits,
      splitType: submittedSplitType,
      canEdit: true,
      canDelete: true,
      isPending: true,
    });

    // Add optimistic activity log
    onOptimisticActivity({
      id: `activity-${pendingId}`,
      action: "expense_added",
      payload: { description: submittedDescription, amountCents, paidByDisplayName },
      createdAt: new Date(),
      actor: { displayName: currentUserDisplayName },
      isPending: true,
    });

    setLoading(true);

    const body: Record<string, unknown> = {
      description: submittedDescription,
      amountCents,
      date: submittedDate,
      paidById: submittedPaidByUserId,
      participantIds: submittedParticipantIds,
      splitType: submittedSplitType,
    };
    if (submittedSplitType === "custom") {
      body.customSplits = submittedParticipantIds.map((id) => ({
        userId: id,
        amountCents: Math.round(parseFloat(submittedCustomAmounts.get(id) ?? "0") * 100),
      }));
    }

    await fetch(`/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    // router.refresh() syncs the real data (including the pending item being replaced)
    onSettled();
  }

  function resetForm() {
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]!);
    setPaidByUserId(currentUserId);
    setParticipantIds(new Set(allMemberIds));
    setSplitType("equal");
    setCustomAmounts(new Map());
    setPercentages(new Map());
    setError(null);
    setAmountError(false);
    setAmountErrorMessage(null);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  const orderedParticipants = members.filter((m) => participantIds.has(m.userId));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition-all duration-150 hover:bg-amber-100 hover:border-amber-300 hover:shadow active:scale-[0.97] cursor-pointer disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:border-amber-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {loading ? "Adding…" : "Add expense"}
      </button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add an expense</h2>
              <p className="text-sm text-gray-400 mt-0.5">Who paid for what?</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="expenseDescription" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Description
                </label>
                <Input
                  id="expenseDescription"
                  type="text"
                  required
                  placeholder="e.g. Birdseed, Field Guide, Binoculars"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="expenseAmount" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Amount ($)
                </label>
                <Input
                  id="expenseAmount"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={amount}
                  hasError={amountError}
                  onChange={(e) => { setAmount(e.target.value); setAmountError(false); setAmountErrorMessage(null); setError(null); }}
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
                <label htmlFor="expenseDate" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Date
                </label>
                <Input
                  id="expenseDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="appearance-none"
                />
              </div>
              <div>
                <label htmlFor="expensePaidBy" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Paid by
                </label>
                <select
                  id="expensePaidBy"
                  value={paidByUserId}
                  onChange={(e) => setPaidByUserId(e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
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
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {m.displayName}
                        {m.userId === currentUserId && (
                          <span className="ml-1 text-xs text-gray-400">(you)</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Split type toggle */}
                {participantIds.size > 0 && (
                  <div className="mt-3">
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium">
                      {(["equal", "percentage", "custom"] as SplitType[]).map((type, i) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleSplitTypeChange(type)}
                          className={`px-3 py-1.5 transition-colors ${i > 0 ? "border-l border-gray-200 dark:border-gray-700" : ""} ${
                            splitType === type
                              ? "bg-indigo-600 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          }`}
                        >
                          {type === "equal" ? "Equal" : type === "percentage" ? "%" : "Custom"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Percentage inputs */}
                {splitType === "percentage" && participantIds.size > 0 && (
                  <div className="mt-3 space-y-2">
                    {orderedParticipants.map((m) => (
                      <div key={m.userId} className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                          {m.displayName}
                          {m.userId === currentUserId && (
                            <span className="ml-1 text-xs text-gray-400">(you)</span>
                          )}
                        </span>
                        <div className="w-24 flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="0.00"
                            value={percentages.get(m.userId) ?? "0.00"}
                            onChange={(e) =>
                              setPercentages((prev) => new Map(prev).set(m.userId, e.target.value))
                            }
                            className="text-right text-sm py-1"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">%</span>
                        </div>
                      </div>
                    ))}
                    {/* Running total indicator for percentages */}
                    {percentageRemaining !== null && (
                      <p
                        className={`text-xs font-medium text-right ${
                          Math.abs(percentageRemaining) < 0.005
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {Math.abs(percentageRemaining) < 0.005
                          ? "Adds up to 100% ✓"
                          : percentageRemaining > 0
                          ? `Remaining: ${percentageRemaining.toFixed(2)}%`
                          : `Over by: ${Math.abs(percentageRemaining).toFixed(2)}%`}
                      </p>
                    )}
                  </div>
                )}

                {/* Custom amount inputs */}
                {splitType === "custom" && participantIds.size > 0 && (
                  <div className="mt-3 space-y-2">
                    {orderedParticipants.map((m) => (
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
                            value={customAmounts.get(m.userId) ?? "0.00"}
                            onChange={(e) =>
                              setCustomAmounts((prev) => new Map(prev).set(m.userId, e.target.value))
                            }
                            className="text-right text-sm py-1"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Running total indicator */}
                    {totalCentsValid && customRemaining !== null && (
                      <p
                        className={`text-xs font-medium text-right ${
                          customRemaining === 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {customRemaining === 0
                          ? "Amounts add up ✓"
                          : customRemaining > 0
                          ? `Remaining: $${(customRemaining / 100).toFixed(2)}`
                          : `Over by: $${(Math.abs(customRemaining) / 100).toFixed(2)}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Add expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
