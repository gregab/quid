"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExpenseRow } from "./ExpensesList";

interface AddExpenseFormProps {
  groupId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  onOptimisticAdd: (expense: ExpenseRow) => void;
  onSettled: () => void;
}

export function AddExpenseForm({
  groupId,
  currentUserId,
  currentUserDisplayName,
  onOptimisticAdd,
  onSettled,
}: AddExpenseFormProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);
    const submittedDescription = description;
    const submittedDate = date;

    // Close modal and clear form immediately (optimistic)
    setOpen(false);
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]!);

    // Add optimistic expense to the list
    const pendingId = `pending-${Date.now()}`;
    onOptimisticAdd({
      id: pendingId,
      description: submittedDescription,
      amountCents,
      date: submittedDate,
      paidById: currentUserId,
      paidByDisplayName: currentUserDisplayName,
      canEdit: true,
      canDelete: true, // current user is always the payer, so canDelete is always true
      isPending: true,
    });

    setLoading(true);

    const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;
    const res = await fetch(`${basePath}/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: submittedDescription, amountCents, date: submittedDate }),
    });

    setLoading(false);

    // router.refresh() syncs the real data (including the pending item being replaced)
    onSettled();
  }

  function handleClose() {
    setOpen(false);
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]!);
    setError(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={loading}>
        {loading ? "Adding…" : "Add expense"}
      </Button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add an expense</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="expenseDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Input
                  id="expenseDescription"
                  type="text"
                  required
                  placeholder="e.g. Dinner, Uber, Groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="expenseAmount" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="expenseDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <Input
                  id="expenseDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400">Split equally among all group members. You are marked as the payer.</p>
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
