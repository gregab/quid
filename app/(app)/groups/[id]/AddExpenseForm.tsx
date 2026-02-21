"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AddExpenseForm({ groupId }: { groupId: string }) {
  const router = useRouter();
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
    setLoading(true);

    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amountCents, date }),
    });

    const json = (await res.json()) as { data?: unknown; error?: string };

    setLoading(false);

    if (!res.ok || json.error) {
      setError(json.error ?? "Something went wrong.");
      return;
    }

    setOpen(false);
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]!);
    router.refresh();
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
      <Button onClick={() => setOpen(true)}>Add expense</Button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Add an expense</h2>
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
              <p className="text-xs text-gray-500">Split equally among all group members. You are marked as the payer.</p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add expense"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
