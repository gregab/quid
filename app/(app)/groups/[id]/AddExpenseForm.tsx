"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";
import { splitAmount } from "@/lib/balances/splitAmount";
import { formatCents } from "@/lib/format";
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

/** Strips non-numeric characters, allowing at most one decimal point. */
function filterDecimalInput(value: string): string {
  let filtered = "";
  let hasDot = false;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") filtered += ch;
    else if (ch === "." && !hasDot) {
      filtered += ch;
      hasDot = true;
    }
  }
  return filtered;
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
  const [recurring, setRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState(false);
  const [amountErrorMessage, setAmountErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parsedTotalCents = Math.round(parseFloat(stripAmountFormatting(amount)) * 100);
  const totalCentsValid = !isNaN(parsedTotalCents) && parsedTotalCents > 0 && parsedTotalCents <= MAX_AMOUNT_CENTS;

  function handleSplitTypeChange(type: SplitType) {
    const ids = [...participantIds];
    if (type === "percentage" && splitType === "equal") {
      // Derive percentages from the penny-distributed equal cent split (same data as Custom view)
      if (ids.length > 0 && totalCentsValid) {
        const equal = splitAmount(parsedTotalCents, ids.length);
        const dollarsMap = new Map<string, string>(ids.map((id, i) => [id, (equal[i]! / 100).toFixed(2)]));
        setPercentages(centsToPercentages(dollarsMap, ids, parsedTotalCents));
      } else {
        setPercentages(new Map(ids.map((id) => [id, "0.00"])));
      }
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
    if (recurring) {
      body.recurring = { frequency: recurringFrequency };
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
    setRecurring(false);
    setRecurringFrequency("monthly");
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
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[10vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden dark:bg-stone-800">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-stone-100 dark:border-stone-700/60">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">Add an expense</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors dark:hover:text-stone-200 dark:hover:bg-stone-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {/* Description + Amount row */}
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <label htmlFor="expenseDescription" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                    Description
                  </label>
                  <Input
                    id="expenseDescription"
                    type="text"
                    required
                    placeholder="e.g. Birdseed, Field Guide"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="w-28 shrink-0">
                  <label htmlFor="expenseAmount" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                    Amount
                  </label>
                  <div className={`flex items-center rounded-lg border overflow-hidden focus-within:ring-2 transition-shadow bg-white dark:bg-stone-900 ${
                    amountError
                      ? "border-red-400 focus-within:ring-red-400 focus-within:border-red-400 dark:border-red-500"
                      : "border-stone-300 focus-within:ring-amber-500 focus-within:border-amber-500 dark:border-stone-700"
                  }`}>
                    <span className="pl-2.5 text-sm text-stone-400 dark:text-stone-500 select-none">$</span>
                    <input
                      id="expenseAmount"
                      type="text"
                      inputMode="decimal"
                      required
                      aria-label="Amount"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setAmountError(false); setAmountErrorMessage(null); setError(null); }}
                      onBlur={handleAmountBlur}
                      onFocus={handleAmountFocus}
                      className="w-full bg-transparent px-1.5 py-2 text-base sm:text-sm text-right text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              {amountErrorMessage && (
                <p className="-mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {amountErrorMessage}
                </p>
              )}

              {/* Date + Paid by row */}
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <label htmlFor="expenseDate" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
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
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                    Paid by
                  </label>
                  <select
                    id="expensePaidBy"
                    value={paidByUserId}
                    onChange={(e) => setPaidByUserId(e.target.value)}
                    className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-stone-900 dark:border-stone-700 dark:text-stone-100"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split between section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Split between</p>
                  {/* Split type toggle */}
                  {participantIds.size > 0 && (
                    <div className="inline-flex rounded-full bg-stone-100 dark:bg-stone-700/60 p-0.5 text-xs font-medium">
                      {(["equal", "percentage", "custom"] as SplitType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleSplitTypeChange(type)}
                          className={`px-2.5 py-1 rounded-full transition-all ${
                            splitType === type
                              ? "bg-white dark:bg-stone-600 text-stone-900 dark:text-white shadow-sm"
                              : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                          }`}
                        >
                          {type === "equal" ? "Equal" : type === "percentage" ? "%" : "Custom $"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 overflow-hidden">
                  {members.map((m, idx) => {
                    const isParticipant = participantIds.has(m.userId);
                    return (
                      <div
                        key={m.userId}
                        className={`flex items-center gap-2.5 px-3 py-2 ${
                          idx % 2 === 1 ? "bg-stone-50/60 dark:bg-stone-750/30" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isParticipant}
                          onChange={() => toggleParticipant(m.userId)}
                          className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 shrink-0"
                        />
                        <span className={`text-sm flex-1 truncate ${isParticipant ? "text-stone-700 dark:text-stone-300" : "text-stone-400 dark:text-stone-500"}`}>
                          {m.displayName}
                          {m.userId === currentUserId && (
                            <span className="ml-1 text-xs text-stone-400">(you)</span>
                          )}
                        </span>
                        {/* Percentage input */}
                        {splitType === "percentage" && isParticipant && (
                          <div className="w-20 flex items-center rounded-lg border border-stone-200 dark:border-stone-600 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-900">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={percentages.get(m.userId) ?? "0.00"}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = filterDecimalInput(e.target.value);
                                setPercentages((prev) => new Map(prev).set(m.userId, val));
                              }}
                              className="w-full bg-transparent pl-2 pr-0.5 py-1 text-right text-sm focus:outline-none dark:text-stone-100"
                            />
                            <span className="pr-1.5 text-sm text-stone-400 dark:text-stone-500 select-none">%</span>
                          </div>
                        )}
                        {/* Custom $ input */}
                        {splitType === "custom" && isParticipant && (
                          <div className="w-24 flex items-center rounded-lg border border-stone-200 dark:border-stone-600 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-900">
                            <span className="pl-2 text-sm text-stone-400 dark:text-stone-500 select-none">$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={customAmounts.get(m.userId) ?? "0.00"}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = filterDecimalInput(e.target.value);
                                setCustomAmounts((prev) => new Map(prev).set(m.userId, val));
                              }}
                              className="w-full bg-transparent px-1 py-1 text-right text-sm focus:outline-none dark:text-stone-100"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Equal split preview */}
                  {splitType === "equal" && totalCentsValid && participantIds.size > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-stone-100 dark:border-stone-700/60 bg-stone-50/40 dark:bg-stone-750/20">
                      <span className="text-xs text-stone-400 dark:text-stone-500">Per person</span>
                      <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                        {formatCents(splitAmount(parsedTotalCents, participantIds.size)[0]!)} each
                        {parsedTotalCents % participantIds.size !== 0 && (
                          <span className="ml-1 text-stone-400 dark:text-stone-500 font-normal">(penny rounded)</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Running total indicator for percentages */}
                  {splitType === "percentage" && percentageRemaining !== null && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-stone-100 dark:border-stone-700/60 bg-stone-50/40 dark:bg-stone-750/20">
                      <span className="text-xs text-stone-400 dark:text-stone-500">Total</span>
                      <span
                        className={`text-xs font-semibold ${
                          Math.abs(percentageRemaining) < 0.005
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {Math.abs(percentageRemaining) < 0.005
                          ? "100% ✓"
                          : percentageRemaining > 0
                          ? `${(100 - percentageRemaining).toFixed(2)}% of 100%`
                          : `${(100 - percentageRemaining).toFixed(2)}% — over by ${Math.abs(percentageRemaining).toFixed(2)}%`}
                      </span>
                    </div>
                  )}

                  {/* Running total indicator for custom */}
                  {splitType === "custom" && totalCentsValid && customRemaining !== null && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-stone-100 dark:border-stone-700/60 bg-stone-50/40 dark:bg-stone-750/20">
                      <span className="text-xs text-stone-400 dark:text-stone-500">Total</span>
                      <span
                        className={`text-xs font-semibold ${
                          customRemaining === 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {customRemaining === 0
                          ? `$${(parsedTotalCents / 100).toFixed(2)} ✓`
                          : customRemaining > 0
                          ? `$${(customSumCents / 100).toFixed(2)} of $${(parsedTotalCents / 100).toFixed(2)}`
                          : `$${(customSumCents / 100).toFixed(2)} — over by $${(Math.abs(customRemaining) / 100).toFixed(2)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Repeat toggle */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Repeat</span>
                </label>
                {recurring && (
                  <select
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as "weekly" | "monthly" | "yearly")}
                    className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-stone-900 dark:border-stone-700 dark:text-stone-100"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              {/* Footer actions */}
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
