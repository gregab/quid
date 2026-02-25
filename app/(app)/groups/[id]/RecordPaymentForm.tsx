"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";
import { MAX_AMOUNT_CENTS, MAX_AMOUNT_DOLLARS, formatAmountDisplay, stripAmountFormatting, filterAmountInput } from "@/lib/amount";
import { formatCents } from "@/lib/format";

export interface UserOwesDebt {
  toId: string;
  toName: string;
  amountCents: number;
}

interface RecordPaymentFormProps {
  groupId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  members: Member[];
  userOwesDebts: UserOwesDebt[];
  onOptimisticAdd: (expense: ExpenseRow) => void;
  onSettled: (pendingId?: string, realId?: string) => void;
  onOptimisticActivity: (log: ActivityLog) => void;
  onCelebration?: (name: string) => void;
}

type ModalStep =
  | { type: "pick" }
  | { type: "form"; preset?: { toName: string } };

export function RecordPaymentForm({
  groupId,
  currentUserId,
  currentUserDisplayName,
  members,
  userOwesDebts,
  onOptimisticAdd,
  onSettled,
  onOptimisticActivity,
  onCelebration,
}: RecordPaymentFormProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>({ type: "pick" });
  const [fromUserId, setFromUserId] = useState(currentUserId);
  const [toUserId, setToUserId] = useState(() => {
    return members.find((m) => m.userId !== currentUserId)?.userId ?? members[0]?.userId ?? "";
  });
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState(false);
  const [amountErrorMessage, setAmountErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPreset = step.type === "form" && !!step.preset;
  const presetToName = step.type === "form" ? step.preset?.toName : undefined;

  // When "from" changes, reset "to" if it's now the same as "from"
  function handleFromChange(newFromId: string) {
    setFromUserId(newFromId);
    if (toUserId === newFromId) {
      const other = members.find((m) => m.userId !== newFromId);
      setToUserId(other?.userId ?? "");
    }
  }

  const toOptions = members.filter((m) => m.userId !== fromUserId);

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

    if (!toUserId || fromUserId === toUserId) {
      setError("From and To must be different people.");
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);
    const submittedFromId = fromUserId;
    const submittedToId = toUserId;
    const submittedDate = new Date().toISOString().split("T")[0]!;

    const fromMember = members.find((m) => m.userId === submittedFromId);
    const toMember = members.find((m) => m.userId === submittedToId);
    const fromDisplayName = fromMember?.displayName ?? currentUserDisplayName;
    const toDisplayName = presetToName ?? toMember?.displayName ?? "";

    const debtForTo = userOwesDebts.find((d) => d.toId === submittedToId);
    const settledUp = isPreset && debtForTo !== undefined && amountCents === debtForTo.amountCents;

    // Trigger celebration for settle-up payments
    if (settledUp && onCelebration) {
      onCelebration(toDisplayName);
    }

    // Close modal and reset
    setOpen(false);
    resetForm();

    // Optimistic expense (payment card)
    const pendingId = `pending-payment-${Date.now()}`;
    onOptimisticAdd({
      id: pendingId,
      description: "Payment",
      amountCents,
      date: submittedDate,
      paidById: submittedFromId,
      paidByDisplayName: fromDisplayName,
      participantIds: [submittedToId],
      splits: [{ userId: submittedToId, amountCents }],
      splitType: "equal",
      canEdit: false,
      canDelete: true,
      isPayment: true,
      settledUp,
      createdById: currentUserId,
      isPending: true,
    });

    // Optimistic activity log
    onOptimisticActivity({
      id: `activity-pending-payment-${Date.now()}`,
      action: "payment_recorded",
      payload: { amountCents, fromDisplayName, toDisplayName, settledUp },
      createdAt: new Date(),
      actor: { displayName: currentUserDisplayName },
      isPending: true,
    });

    setLoading(true);

    const res = await fetch(`/api/groups/${groupId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents,
        date: submittedDate,
        paidById: submittedFromId,
        recipientId: submittedToId,
        settledUp,
      }),
    });

    setLoading(false);

    let realId: string | undefined;
    try {
      const json = await res.json();
      realId = json?.data?.id;
    } catch { /* non-critical */ }
    onSettled(pendingId, realId);
  }

  function resetForm() {
    setAmount("");
    setFromUserId(currentUserId);
    setToUserId(members.find((m) => m.userId !== currentUserId)?.userId ?? members[0]?.userId ?? "");
    setError(null);
    setAmountError(false);
    setAmountErrorMessage(null);
    setStep({ type: "pick" });
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function handleSelectDebt(debt: UserOwesDebt) {
    setFromUserId(currentUserId);
    setToUserId(debt.toId);
    setAmount(formatAmountDisplay(String(debt.amountCents / 100)));
    setError(null);
    setAmountError(false);
    setAmountErrorMessage(null);
    setStep({ type: "form", preset: { toName: debt.toName } });
  }

  function handleRecordOther() {
    setFromUserId(currentUserId);
    setToUserId(members.find((m) => m.userId !== currentUserId)?.userId ?? members[0]?.userId ?? "");
    setAmount("");
    setError(null);
    setAmountError(false);
    setAmountErrorMessage(null);
    setStep({ type: "form" });
  }

  function handleBack() {
    setAmount("");
    setError(null);
    setAmountError(false);
    setAmountErrorMessage(null);
    setStep({ type: "pick" });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition-all duration-150 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow active:scale-[0.97] cursor-pointer disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:hover:border-emerald-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {loading ? "Recording…" : "Settle up"}
      </button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-stone-800">

            {/* ── Step 1: Pick who to pay ── */}
            {step.type === "pick" && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">Settle up</h2>
                    {userOwesDebts.length > 0 && (
                      <p className="text-sm text-stone-400 mt-0.5">Select who you want to pay.</p>
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700 dark:hover:text-stone-300 transition-colors"
                    aria-label="Close"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {userOwesDebts.length > 0 ? (
                  <div className="space-y-2 mb-5">
                    {userOwesDebts.map((debt) => (
                      <button
                        key={debt.toId}
                        onClick={() => handleSelectDebt(debt)}
                        className="w-full flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.99] dark:border-stone-700 dark:bg-white/[0.03] dark:hover:border-emerald-600 dark:hover:bg-emerald-900/20 group cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-stone-900 dark:text-white text-sm">
                            {debt.toName}
                          </span>
                          <span className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                            you owe
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                            {formatCents(debt.amountCents)}
                          </span>
                          <svg
                            className="h-4 w-4 text-stone-300 group-hover:text-emerald-500 dark:text-stone-600 dark:group-hover:text-emerald-400 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    You&apos;re all settled up!
                  </div>
                )}

                <div className={`${userOwesDebts.length > 0 ? "border-t border-stone-100 dark:border-stone-700 pt-4" : ""}`}>
                  <button
                    onClick={handleRecordOther}
                    className="text-sm text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors cursor-pointer"
                  >
                    Record other payment →
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Payment form ── */}
            {step.type === "form" && (
              <>
                <div className="flex items-start gap-2 mb-5">
                  <button
                    onClick={handleBack}
                    className="mt-0.5 rounded-lg p-1 -ml-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700 dark:hover:text-stone-300 transition-colors shrink-0"
                    aria-label="Back"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                      {presetToName ? `Pay ${presetToName}` : "Record a payment"}
                    </h2>
                    {!isPreset && (
                      <p className="text-sm text-stone-400 mt-0.5">Record money sent outside the app.</p>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* From field */}
                  <div>
                    {isPreset ? (
                      <>
                        <label className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">From</label>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 dark:bg-white/[0.03] dark:border-stone-700 dark:text-stone-300">
                          {currentUserDisplayName}{" "}
                          <span className="text-stone-400 dark:text-stone-500">(you)</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <label htmlFor="paymentFrom" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                          From (who sent money)
                        </label>
                        <select
                          id="paymentFrom"
                          value={fromUserId}
                          onChange={(e) => handleFromChange(e.target.value)}
                          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow dark:bg-stone-900 dark:border-stone-700 dark:text-stone-100"
                        >
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>

                  {/* To field */}
                  <div>
                    {isPreset ? (
                      <>
                        <label className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">To</label>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 dark:bg-white/[0.03] dark:border-stone-700 dark:text-stone-300">
                          {presetToName}
                        </div>
                      </>
                    ) : (
                      <>
                        <label htmlFor="paymentTo" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                          To (who received money)
                        </label>
                        <select
                          id="paymentTo"
                          value={toUserId}
                          onChange={(e) => setToUserId(e.target.value)}
                          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow dark:bg-stone-900 dark:border-stone-700 dark:text-stone-100"
                        >
                          {toOptions.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label htmlFor="paymentAmount" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                      Amount ($)
                    </label>
                    <Input
                      id="paymentAmount"
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={amount}
                      hasError={amountError}
                      onChange={(e) => { setAmount(filterAmountInput(e.target.value)); setAmountError(false); setAmountErrorMessage(null); setError(null); }}
                      onBlur={handleAmountBlur}
                      onFocus={handleAmountFocus}
                      autoFocus
                    />
                    {amountErrorMessage && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {amountErrorMessage}
                      </p>
                    )}
                    {isPreset && !amountErrorMessage && (
                      <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                        Full balance owed — you can pay a partial amount too.
                      </p>
                    )}
                  </div>

                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                  <div className="flex gap-2 justify-end pt-1">
                    <Button type="button" variant="ghost" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Record payment
                    </Button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
