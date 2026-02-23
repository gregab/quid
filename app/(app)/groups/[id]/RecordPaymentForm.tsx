"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";

interface RecordPaymentFormProps {
  groupId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  members: Member[];
  onOptimisticAdd: (expense: ExpenseRow) => void;
  onSettled: () => void;
  onOptimisticActivity: (log: ActivityLog) => void;
}

export function RecordPaymentForm({
  groupId,
  currentUserId,
  currentUserDisplayName,
  members,
  onOptimisticAdd,
  onSettled,
  onOptimisticActivity,
}: RecordPaymentFormProps) {
  const [open, setOpen] = useState(false);
  const [fromUserId, setFromUserId] = useState(currentUserId);
  const [toUserId, setToUserId] = useState(() => {
    // Default recipient: first member who isn't the current user
    return members.find((m) => m.userId !== currentUserId)?.userId ?? members[0]?.userId ?? "";
  });
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // When "from" changes, reset "to" if it's now the same as "from"
  function handleFromChange(newFromId: string) {
    setFromUserId(newFromId);
    if (toUserId === newFromId) {
      const other = members.find((m) => m.userId !== newFromId);
      setToUserId(other?.userId ?? "");
    }
  }

  const toOptions = members.filter((m) => m.userId !== fromUserId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (!toUserId || fromUserId === toUserId) {
      setError("From and To must be different people.");
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);
    const submittedFromId = fromUserId;
    const submittedToId = toUserId;
    const submittedDate = date;

    const fromMember = members.find((m) => m.userId === submittedFromId);
    const toMember = members.find((m) => m.userId === submittedToId);
    const fromDisplayName = fromMember?.displayName ?? currentUserDisplayName;
    const toDisplayName = toMember?.displayName ?? "";

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
      canEdit: false,
      canDelete: true,
      isPayment: true,
      createdById: currentUserId,
      isPending: true,
    });

    // Optimistic activity log
    onOptimisticActivity({
      id: `activity-pending-payment-${Date.now()}`,
      action: "payment_recorded",
      payload: { amountCents, fromDisplayName, toDisplayName },
      createdAt: new Date(),
      actor: { displayName: currentUserDisplayName },
      isPending: true,
    });

    setLoading(true);

    const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary").pathname;
    await fetch(`${basePath}/api/groups/${groupId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents,
        date: submittedDate,
        paidById: submittedFromId,
        recipientId: submittedToId,
      }),
    });

    setLoading(false);
    onSettled();
  }

  function resetForm() {
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]!);
    setFromUserId(currentUserId);
    setToUserId(members.find((m) => m.userId !== currentUserId)?.userId ?? members[0]?.userId ?? "");
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        title="Record payment"
        aria-label="Record payment"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 p-2 sm:px-4 sm:py-2 text-sm font-semibold text-emerald-800 shadow-sm transition-all duration-150 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow active:scale-[0.97] cursor-pointer disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:hover:border-emerald-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          <circle cx="12" cy="12" r="10" strokeWidth={2} stroke="currentColor" fill="none" />
        </svg>
        <span className="hidden sm:inline">{loading ? "Recording…" : "Record payment"}</span>
      </button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Record a payment</h2>
              <p className="text-sm text-gray-400 mt-0.5">Record money sent outside the app.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="paymentFrom" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  From (who sent money)
                </label>
                <select
                  id="paymentFrom"
                  value={fromUserId}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="paymentTo" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  To (who received money)
                </label>
                <select
                  id="paymentTo"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  {toOptions.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}{m.userId === currentUserId ? " (you)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Amount ($)
                </label>
                <Input
                  id="paymentAmount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Date
                </label>
                <Input
                  id="paymentDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="appearance-none"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Record payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
