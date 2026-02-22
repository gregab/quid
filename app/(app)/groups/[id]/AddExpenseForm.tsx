"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow, Member } from "./ExpensesList";
import type { ActivityLog } from "./ActivityFeed";

interface AddExpenseFormProps {
  groupId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  members: Member[];
  onOptimisticAdd: (expense: ExpenseRow) => void;
  onSettled: () => void;
  onOptimisticActivity: (log: ActivityLog) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
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
    const submittedDescription = description;
    const submittedDate = date;
    const submittedPaidByUserId = paidByUserId;
    const submittedParticipantIds = [...participantIds];

    const paidByMember = members.find((m) => m.userId === submittedPaidByUserId);
    const paidByDisplayName = paidByMember?.displayName ?? currentUserDisplayName;

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

    const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;
    await fetch(`${basePath}/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: submittedDescription,
        amountCents,
        date: submittedDate,
        paidById: submittedPaidByUserId,
        participantIds: submittedParticipantIds,
      }),
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
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition-all duration-150 hover:bg-amber-100 hover:border-amber-300 hover:shadow active:scale-[0.97] cursor-pointer disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:border-amber-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {loading ? "Adding…" : "Add expense"}
      </button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl overflow-hidden dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-white">Add an expense</h2>
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
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
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
