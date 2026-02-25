"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";
import { splitAmount } from "@/lib/balances/splitAmount";
import { formatCents } from "@/lib/format";
import { MAX_AMOUNT_CENTS, MAX_AMOUNT_DOLLARS, formatAmountDisplay, stripAmountFormatting } from "@/lib/amount";
import { percentagesToCents, centsToPercentages } from "@/lib/percentageSplit";
import { MAX_EXPENSE_DESCRIPTION } from "@/lib/constants";

interface AddExpenseFormProps {
  groupId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  members: Member[];
  onOptimisticAdd: (expense: ExpenseRow) => void;
  onSettled: (pendingId?: string, realId?: string) => void;
  onOptimisticActivity: (log: ActivityLog) => void;
  renderTrigger?: (props: { onClick: () => void; loading: boolean }) => React.ReactNode;
}

type SplitType = "equal" | "percentage" | "custom";
type MobileScreen = "quick-entry" | "split-options" | "advanced-split";

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
function filterDecimalInput(value: string): string {
  let filtered = "";
  let hasDot = false;
  let decimals = 0;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      if (hasDot && decimals >= 2) continue;
      filtered += ch;
      if (hasDot) decimals++;
    } else if (ch === "." && !hasDot) {
      filtered += ch;
      hasDot = true;
    }
  }
  return filtered;
}

/** Like filterDecimalInput but also allows commas (for formatted dollar amounts). */
function filterAmountInput(value: string): string {
  let filtered = "";
  let hasDot = false;
  let decimals = 0;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      if (hasDot && decimals >= 2) continue;
      filtered += ch;
      if (hasDot) decimals++;
    } else if (ch === "." && !hasDot) {
      filtered += ch;
      hasDot = true;
    } else if (ch === ",") {
      filtered += ch;
    }
  }
  return filtered;
}

/** Strips non-numeric characters, integers only, max 3 digits (for 0–100%). */
function filterIntegerInput(value: string): string {
  let filtered = "";
  for (const ch of value) {
    if (ch >= "0" && ch <= "9" && filtered.length < 3) filtered += ch;
  }
  return filtered;
}

/** Hook to detect mobile viewport (< 640px, matching Tailwind's `sm:` breakpoint). */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

/** Generate human-readable summary of the current split configuration. */
function getSplitSummary(
  paidByUserId: string,
  currentUserId: string,
  members: Member[],
  splitType: SplitType,
  participantIds: Set<string>,
  allMemberIds: string[],
  customAmounts?: Map<string, string>
): string {
  const paidByMe = paidByUserId === currentUserId;
  const paidByMember = members.find((m) => m.userId === paidByUserId);
  const paidByName = paidByMe ? "you" : (paidByMember?.displayName ?? "someone");

  const allParticipating = participantIds.size === allMemberIds.length &&
    allMemberIds.every((id) => participantIds.has(id));

  let splitText: string;
  if (splitType === "equal" && allParticipating) {
    splitText = "split equally";
  } else if (splitType === "equal") {
    splitText = `split equally among ${participantIds.size}`;
  } else if (splitType === "percentage") {
    splitText = "split by percentage";
  } else {
    // Check if one person owes the full amount (2-person "owed full" preset)
    if (customAmounts && members.length === 2) {
      const payerAmount = Math.round(parseFloat(customAmounts.get(paidByUserId) ?? "0") * 100);
      if (payerAmount === 0) {
        const otherMember = members.find((m) => m.userId !== paidByUserId);
        if (otherMember) {
          const otherName = otherMember.userId === currentUserId ? "you owe" : `${otherMember.displayName} owes`;
          splitText = `${otherName} the full amount`;
        } else {
          splitText = "split with custom amounts";
        }
      } else {
        splitText = "split with custom amounts";
      }
    } else {
      splitText = "split with custom amounts";
    }
  }

  return `Paid by ${paidByName}, ${splitText}`;
}

export function AddExpenseForm({
  groupId,
  currentUserId,
  currentUserDisplayName,
  members,
  onOptimisticAdd,
  onSettled,
  onOptimisticActivity,
  renderTrigger,
}: AddExpenseFormProps) {
  const allMemberIds = members.map((m) => m.userId);
  const isMobile = useIsMobile();

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

  // Mobile multi-screen state
  const [screen, setScreen] = useState<MobileScreen>("quick-entry");
  const [slideDirection, setSlideDirection] = useState<"forward" | "back">("forward");

  // Desktop progressive disclosure — split section collapsed by default
  const [splitExpanded, setSplitExpanded] = useState(false);

  const parsedTotalCents = Math.round(parseFloat(stripAmountFormatting(amount)) * 100);
  const totalCentsValid = !isNaN(parsedTotalCents) && parsedTotalCents > 0 && parsedTotalCents <= MAX_AMOUNT_CENTS;

  function navigateTo(target: MobileScreen) {
    const order: MobileScreen[] = ["quick-entry", "split-options", "advanced-split"];
    const currentIdx = order.indexOf(screen);
    const targetIdx = order.indexOf(target);
    setSlideDirection(targetIdx > currentIdx ? "forward" : "back");
    setScreen(target);
    // Clear validation errors when navigating — prevents stale warnings from
    // a previous submit attempt remaining visible after the user fixes the issue.
    setError(null);
  }

  function handleSplitTypeChange(type: SplitType) {
    const ids = [...participantIds];
    if (type === "percentage" && splitType === "equal") {
      if (ids.length > 0 && totalCentsValid) {
        const equal = splitAmount(parsedTotalCents, ids.length);
        const dollarsMap = new Map<string, string>(ids.map((id, i) => [id, (equal[i]! / 100).toFixed(2)]));
        setPercentages(centsToPercentages(dollarsMap, ids, parsedTotalCents));
      } else {
        setPercentages(new Map(ids.map((id) => [id, "0"])));
      }
    } else if (type === "percentage" && splitType === "custom") {
      if (totalCentsValid) {
        setPercentages(centsToPercentages(customAmounts, ids, parsedTotalCents));
      } else {
        setPercentages(new Map(ids.map((id) => [id, "0"])));
      }
    } else if (type === "custom" && splitType === "equal") {
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
          setPercentages((m) => new Map(m).set(userId, "0"));
        }
      }
      return next;
    });
  }

  // Scale custom amounts when total changes
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

  /** Apply a preset split configuration (used on mobile split-options screen). */
  const applyPreset = useCallback((
    newPaidBy: string,
    newSplitType: SplitType,
    newParticipantIds: string[],
    newCustomAmounts?: Map<string, string>
  ) => {
    setPaidByUserId(newPaidBy);
    setSplitType(newSplitType);
    setParticipantIds(new Set(newParticipantIds));
    if (newCustomAmounts) {
      setCustomAmounts(newCustomAmounts);
    }
    navigateTo("quick-entry");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const res = await fetch(`/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    // Pass the real DB id so the parent can swap the pending key before
    // router.refresh() lands — prevents React from remounting the card.
    let realId: string | undefined;
    try {
      const json = await res.json();
      realId = json?.data?.id;
    } catch { /* non-critical — refresh will reconcile anyway */ }
    onSettled(pendingId, realId);
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
    setShowAmountRequired(false);
    setSplitExpanded(false);
    setScreen("quick-entry");
    setSlideDirection("forward");
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  // Format today's date nicely for the mobile date pill
  function formatDatePill(dateStr: string): string {
    const today = new Date().toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    const [year, month, day] = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(month!, 10) - 1]} ${parseInt(day!, 10)}, ${year}`;
  }

  const summaryText = getSplitSummary(paidByUserId, currentUserId, members, splitType, participantIds, allMemberIds, customAmounts);

  // State for "enter amount first" validation nudge
  const [showAmountRequired, setShowAmountRequired] = useState(false);

  // ─── Shared Split Section (used by desktop + mobile advanced screen) ───

  function renderSplitSection() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Split between</p>
        </div>

        {/* Split type toggle — segmented control */}
        {participantIds.size > 0 && (
          <div className="grid grid-cols-3 rounded-xl bg-stone-100 dark:bg-stone-800 p-1 text-sm font-medium">
            {(["equal", "percentage", "custom"] as SplitType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSplitTypeChange(type)}
                className={`py-2 rounded-lg transition-all ${
                  splitType === type
                    ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm"
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                }`}
              >
                {type === "equal" ? "Equal" : type === "percentage" ? "Percent" : "Custom $"}
              </button>
            ))}
          </div>
        )}

        {/* Member list */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
          {members.map((m) => {
            const isParticipant = participantIds.has(m.userId);
            return (
              <div
                key={m.userId}
                className="flex items-center gap-3 px-3.5 py-2.5"
              >
                <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:opacity-80">
                  <span
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      isParticipant
                        ? "bg-amber-500 border-amber-500 scale-100"
                        : "border-stone-300 dark:border-stone-600 scale-95"
                    }`}
                  >
                    {isParticipant && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={isParticipant}
                    onChange={() => toggleParticipant(m.userId)}
                    className="sr-only"
                  />
                  <span className={`text-sm flex-1 truncate ${isParticipant ? "text-stone-800 dark:text-stone-200" : "text-stone-400 dark:text-stone-500"}`}>
                    {m.displayName}
                    {m.userId === currentUserId && (
                      <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">(you)</span>
                    )}
                  </span>
                </label>
                {/* Percentage input */}
                {splitType === "percentage" && isParticipant && (
                  <div className="w-20 flex items-center rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-800">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={percentages.get(m.userId) ?? "0"}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = filterIntegerInput(e.target.value);
                        setPercentages((prev) => new Map(prev).set(m.userId, val));
                      }}
                      className="w-full bg-transparent pl-2 pr-0.5 py-1.5 text-right text-base focus:outline-none text-stone-900 dark:text-stone-100"
                    />
                    <span className="pr-2 text-sm text-stone-400 dark:text-stone-500 select-none">%</span>
                  </div>
                )}
                {/* Custom $ input */}
                {splitType === "custom" && isParticipant && (
                  <div className="w-26 flex items-center rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-800">
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
                      className="w-full bg-transparent px-1 py-1.5 text-right text-base focus:outline-none text-stone-900 dark:text-stone-100"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Equal split preview */}
          {splitType === "equal" && totalCentsValid && participantIds.size > 0 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/50">
              <span className="text-xs text-stone-500 dark:text-stone-400">Per person</span>
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
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/50">
              <span className="text-xs text-stone-500 dark:text-stone-400">Total</span>
              <span
                className={`text-xs font-semibold ${
                  percentageRemaining === 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                }`}
              >
                {percentageRemaining === 0
                  ? "100% \u2713"
                  : percentageRemaining > 0
                  ? `${100 - percentageRemaining}% of 100%`
                  : `${100 - percentageRemaining}% — over by ${Math.abs(percentageRemaining)}%`}
              </span>
            </div>
          )}

          {/* Running total indicator for custom */}
          {splitType === "custom" && totalCentsValid && customRemaining !== null && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/50">
              <span className="text-xs text-stone-500 dark:text-stone-400">Total</span>
              <span
                className={`text-xs font-semibold ${
                  customRemaining === 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                }`}
              >
                {customRemaining === 0
                  ? `$${(parsedTotalCents / 100).toFixed(2)} \u2713`
                  : customRemaining > 0
                  ? `$${(customSumCents / 100).toFixed(2)} of $${(parsedTotalCents / 100).toFixed(2)}`
                  : `$${(customSumCents / 100).toFixed(2)} — over by $${(Math.abs(customRemaining) / 100).toFixed(2)}`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Desktop Modal ───

  function renderDesktopModal() {
    return (
      <div
        className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[10vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div className="modal-content bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden dark:bg-stone-800">
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
            {/* Description */}
            <div>
              <label htmlFor="expenseDescription" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                Description
              </label>
              <Input
                id="expenseDescription"
                type="text"
                required
                maxLength={MAX_EXPENSE_DESCRIPTION}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="expenseAmount" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                Amount
              </label>
              <div className={`flex items-center rounded-lg border overflow-hidden focus-within:ring-2 transition-shadow bg-white dark:bg-stone-900 ${
                amountError
                  ? "border-red-400 focus-within:ring-red-400 focus-within:border-red-400 dark:border-red-500"
                  : "border-stone-300 focus-within:ring-amber-500 focus-within:border-amber-500 dark:border-stone-700"
              }`}>
                <span className="pl-3 text-sm text-stone-400 dark:text-stone-500 select-none">$</span>
                <input
                  id="expenseAmount"
                  type="text"
                  inputMode="decimal"
                  required
                  aria-label="Amount"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(filterAmountInput(e.target.value)); setAmountError(false); setAmountErrorMessage(null); setError(null); }}
                  onBlur={handleAmountBlur}
                  onFocus={handleAmountFocus}
                  className="w-full bg-transparent px-2 py-2 text-base sm:text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none"
                />
              </div>
              {amountErrorMessage && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {amountErrorMessage}
                </p>
              )}
            </div>

            {/* Date pill — compact, click to change */}
            <div className="flex items-center gap-2">
              <input
                id="expenseDate"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="sr-only"
              />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-700/60 text-sm font-medium text-stone-700 dark:text-stone-300 cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
                  <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {formatDatePill(date)}
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  tabIndex={-1}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Split summary pill — click to expand/collapse split options */}
            <button
              type="button"
              onClick={() => setSplitExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-700/40 border border-stone-150 dark:border-stone-700 text-left transition-colors hover:bg-stone-100 dark:hover:bg-stone-700/60 active:scale-[0.99]"
            >
              <span className="text-sm text-stone-600 dark:text-stone-300">{summaryText}</span>
              <svg
                className={`w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0 ml-2 transition-transform duration-200 ${splitExpanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Expandable split options section */}
            <div className={`debt-expand ${splitExpanded ? "open" : ""}`}>
              <div>
                <div className="space-y-4">
                  {/* Paid by dropdown */}
                  <div>
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

                  {/* Split type toggle + member checkboxes */}
                  {renderSplitSection()}

                  {/* Repeat toggle */}
                  <div className="flex items-center gap-2.5">
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
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {/* Footer actions */}
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!description.trim() || !totalCentsValid}>
                Add expense
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── Mobile Screen 1: Quick Entry ───

  function renderMobileQuickEntry() {
    return (
      <div
        key="quick-entry"
        className={slideDirection === "back" ? "screen-slide-back" : ""}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-700/60">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Add an expense</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 -mr-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors dark:hover:text-stone-200 dark:hover:bg-stone-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 px-4 pt-5 pb-6">
          <div className="space-y-5 flex-1">
            {/* Description - large input */}
            <div>
              <label htmlFor="mobileDescription" className="block text-base font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                Description
              </label>
              <input
                id="mobileDescription"
                type="text"
                required
                autoComplete="off"
                maxLength={MAX_EXPENSE_DESCRIPTION}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
                className="w-full text-xl px-0 py-2.5 bg-transparent border-0 border-b-2 border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition-colors"
              />
            </div>

            {/* Amount - large prominent input */}
            <div>
              <label htmlFor="mobileAmount" className="block text-base font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                Amount
              </label>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-stone-300 dark:text-stone-600 select-none">$</span>
                <input
                  id="mobileAmount"
                  type="text"
                  inputMode="decimal"
                  required
                  autoComplete="off"
                  aria-label="Amount"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(filterAmountInput(e.target.value)); setAmountError(false); setAmountErrorMessage(null); setError(null); setShowAmountRequired(false); }}
                  onBlur={handleAmountBlur}
                  onFocus={handleAmountFocus}
                  className="flex-1 text-3xl font-bold px-0 py-2.5 bg-transparent border-0 border-b-2 border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition-colors"
                />
              </div>
              {amountErrorMessage && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {amountErrorMessage}
                </p>
              )}
            </div>

            {/* Date pill */}
            <div className="flex items-center gap-2">
              <label htmlFor="mobileDatePicker" className="text-sm text-stone-500 dark:text-stone-400">Date:</label>
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-700/60 text-sm font-medium text-stone-700 dark:text-stone-300">
                  <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {formatDatePill(date)}
                </span>
                <input
                  id="mobileDatePicker"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Amount required nudge */}
            {showAmountRequired && (
              <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 -mt-2">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Enter an amount before choosing how to split
              </p>
            )}

            {/* Summary pill - tappable, navigates to split options */}
            <button
              type="button"
              onClick={() => {
                if (!totalCentsValid) {
                  setShowAmountRequired(true);
                  return;
                }
                navigateTo("split-options");
              }}
              data-testid="split-summary-pill"
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-700/40 border border-stone-150 dark:border-stone-700 text-left transition-colors hover:bg-stone-100 dark:hover:bg-stone-700/60 active:scale-[0.99]"
            >
              <span className="text-sm text-stone-600 dark:text-stone-300">{summaryText}</span>
              <svg className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0 ml-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>

          {/* Full-width submit button at bottom */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={!description.trim() || !totalCentsValid}
              className="w-full py-3.5 rounded-xl bg-amber-600 text-white font-semibold text-base shadow-sm transition-all duration-150 hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              Add expense
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Mobile Screen 2: Split Options ───

  function renderMobileSplitOptions() {
    const otherMembers = members.filter((m) => m.userId !== currentUserId);
    const is2Person = members.length === 2 && otherMembers.length === 1;
    const otherMember = otherMembers[0];

    /** Compute what someone owes for a preset, returns formatted string or null if amount not entered. */
    function presetOwesText(payerId: string, fullAmount: boolean): string | null {
      if (!totalCentsValid) return null;
      if (is2Person) {
        if (fullAmount) {
          return formatCents(parsedTotalCents);
        }
        // Split equally between 2
        const perPerson = splitAmount(parsedTotalCents, 2);
        // The non-payer owes the payer their share
        return formatCents(perPerson[1]!);
      }
      return null;
    }

    return (
      <div
        key="split-options"
        className={slideDirection === "forward" ? "screen-slide-forward" : "screen-slide-back"}
      >
        {/* Header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-700/60">
          <button
            type="button"
            onClick={() => navigateTo("quick-entry")}
            className="p-1 -ml-1 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Split options</h2>
        </div>

        <div className="px-4 py-4 space-y-3">
          {is2Person && otherMember ? (
            <>
              {/* 2-person preset cards */}
              {/* You paid, split equally */}
              <button
                type="button"
                data-testid="preset-you-paid-equal"
                onClick={() => applyPreset(currentUserId, "equal", allMemberIds)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                  paidByUserId === currentUserId && splitType === "equal"
                    ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-900/20"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                }`}
              >
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">You paid, split equally</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  {otherMember.displayName} owes you {presetOwesText(currentUserId, false) ?? "half"}
                </p>
              </button>

              {/* You are owed the full amount */}
              <button
                type="button"
                data-testid="preset-you-owed-full"
                onClick={() => {
                  const custom = new Map<string, string>();
                  custom.set(currentUserId, "0.00");
                  custom.set(otherMember.userId, totalCentsValid ? (parsedTotalCents / 100).toFixed(2) : "0.00");
                  applyPreset(currentUserId, "custom", allMemberIds, custom);
                }}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                  paidByUserId === currentUserId && splitType === "custom" &&
                  Math.round(parseFloat(customAmounts.get(currentUserId) ?? "0") * 100) === 0
                    ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-900/20"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                }`}
              >
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">You are owed the full amount</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  {otherMember.displayName} owes you {presetOwesText(currentUserId, true) ?? "the full amount"}
                </p>
              </button>

              {/* Other person paid, split equally */}
              <button
                type="button"
                data-testid="preset-other-paid-equal"
                onClick={() => applyPreset(otherMember.userId, "equal", allMemberIds)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                  paidByUserId === otherMember.userId && splitType === "equal"
                    ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-900/20"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                }`}
              >
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">{otherMember.displayName} paid, split equally</p>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                  You owe {otherMember.displayName} {presetOwesText(otherMember.userId, false) ?? "half"}
                </p>
              </button>

              {/* Other person is owed the full amount */}
              <button
                type="button"
                data-testid="preset-other-owed-full"
                onClick={() => {
                  const custom = new Map<string, string>();
                  custom.set(otherMember.userId, "0.00");
                  custom.set(currentUserId, totalCentsValid ? (parsedTotalCents / 100).toFixed(2) : "0.00");
                  applyPreset(otherMember.userId, "custom", allMemberIds, custom);
                }}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                  paidByUserId === otherMember.userId && splitType === "custom" &&
                  Math.round(parseFloat(customAmounts.get(otherMember.userId) ?? "0") * 100) === 0
                    ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-900/20"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                }`}
              >
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">{otherMember.displayName} is owed the full amount</p>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                  You owe {otherMember.displayName} {presetOwesText(otherMember.userId, true) ?? "the full amount"}
                </p>
              </button>
            </>
          ) : (
            <>
              {/* 3+ person: payer dropdown + participant checklist */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5 dark:text-stone-300">
                  Paid by
                </label>
                <select
                  value={paidByUserId}
                  onChange={(e) => setPaidByUserId(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-stone-800 dark:border-stone-700 dark:text-stone-100"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5 dark:text-stone-300">
                  Split between
                </label>
                <div className="space-y-1.5">
                  {members.map((m) => {
                    const isChecked = participantIds.has(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => toggleParticipant(m.userId)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                          isChecked
                            ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-900/20"
                            : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800 opacity-60"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden ${
                          isChecked
                            ? "bg-amber-200 text-amber-800 dark:bg-amber-700 dark:text-amber-100"
                            : "bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-500"
                        }`}>
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            m.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                          {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                        </span>
                        <div className={`w-5 h-5 rounded-md border-2 ml-auto flex items-center justify-center transition-colors ${
                          isChecked
                            ? "bg-amber-500 border-amber-500 dark:bg-amber-500 dark:border-amber-500"
                            : "border-stone-300 dark:border-stone-600"
                        }`}>
                          {isChecked && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigateTo("quick-entry")}
                className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm shadow-sm transition-all hover:bg-amber-700 active:scale-[0.98] dark:bg-amber-500 dark:hover:bg-amber-600"
              >
                Done
              </button>
            </>
          )}

          {/* "More options" link to advanced screen */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigateTo("advanced-split")}
              className="w-full py-2.5 text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            >
              More options...
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Mobile Screen 3: Advanced Split ───

  function renderMobileAdvancedSplit() {
    return (
      <div
        key="advanced-split"
        className={slideDirection === "forward" ? "screen-slide-forward" : "screen-slide-back"}
      >
        {/* Header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-700/60">
          <button
            type="button"
            onClick={() => navigateTo("split-options")}
            className="p-1 -ml-1 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Advanced options</h2>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Paid by dropdown */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
              Paid by
            </label>
            <select
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-stone-900 dark:border-stone-700 dark:text-stone-100"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Split configuration */}
          {renderSplitSection()}

          {/* Recurring toggle */}
          <div className="flex items-center gap-2.5">
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

          {/* Done button */}
          <button
            type="button"
            onClick={() => navigateTo("quick-entry")}
            className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm shadow-sm transition-all hover:bg-amber-700 active:scale-[0.98] dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ─── Mobile Modal (full-screen takeover) ───

  function renderMobileModal() {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-stone-900 flex flex-col overflow-y-auto modal-backdrop">
        {screen === "quick-entry" && renderMobileQuickEntry()}
        {screen === "split-options" && renderMobileSplitOptions()}
        {screen === "advanced-split" && renderMobileAdvancedSplit()}
      </div>
    );
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ onClick: () => setOpen(true), loading })
      ) : (
        <button
          onClick={() => setOpen(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/20 transition-all duration-150 hover:bg-amber-600 hover:shadow-md hover:shadow-amber-500/25 active:scale-[0.97] cursor-pointer disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400 dark:shadow-amber-500/15"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {loading ? "Adding\u2026" : "Add expense"}
        </button>
      )}

      {open && (isMobile ? renderMobileModal() : renderDesktopModal())}
    </>
  );
}
