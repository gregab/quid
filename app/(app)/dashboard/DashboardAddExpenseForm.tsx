"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDisplayName } from "@/lib/formatDisplayName";
import {
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  formatAmountDisplay,
  stripAmountFormatting,
  filterAmountInput,
} from "@/lib/amount";
import { MAX_EXPENSE_DESCRIPTION } from "@/lib/constants";

export interface DashboardContact {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  emoji?: string;
}

interface DashboardAddExpenseFormProps {
  currentUserId: string;
  contacts: DashboardContact[];
  renderTrigger?: (props: { onClick: () => void; loading: boolean }) => React.ReactNode;
}

export function DashboardAddExpenseForm({
  currentUserId,
  contacts,
  renderTrigger,
}: DashboardAddExpenseFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [paidById, setPaidById] = useState(currentUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedFriends(new Set());
    setDescription("");
    setAmountStr("");
    setDate(new Date().toISOString().split("T")[0]!);
    setPaidById(currentUserId);
    setError(null);
  }, [currentUserId]);

  const handleOpen = useCallback(() => {
    resetForm();
    setOpen(true);
  }, [resetForm]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleFriend = useCallback((userId: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
    // Reset paidById to current user when selection changes
    setPaidById(currentUserId);
  }, [currentUserId]);

  const handleAmountChange = useCallback((raw: string) => {
    const filtered = filterAmountInput(raw);
    setAmountStr(filtered);
  }, []);

  const handleSubmit = async () => {
    const friendIds = Array.from(selectedFriends);
    if (friendIds.length === 0) {
      setError("Select at least one friend.");
      return;
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setError("Description is required.");
      return;
    }

    const cents = Math.round(parseFloat(stripAmountFormatting(amountStr)) * 100);
    if (!cents || cents <= 0 || isNaN(cents)) {
      setError("Enter a valid amount.");
      return;
    }
    if (cents > MAX_AMOUNT_CENTS) {
      setError(`Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/friends/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendIds,
          description: trimmedDesc,
          amountCents: cents,
          date,
          paidById: paidById !== currentUserId ? paidById : undefined,
        }),
      });

      const json = (await res.json()) as { data: unknown; error: string | null };
      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show payer selector only when exactly 1 friend is selected
  const showPayerSelector = selectedFriends.size === 1;
  const singleFriend = showPayerSelector
    ? contacts.find((c) => selectedFriends.has(c.userId))
    : null;

  if (renderTrigger) {
    return (
      <>
        {renderTrigger({ onClick: handleOpen, loading })}
        {open && (
          <Modal onClose={handleClose}>
            <FormContent
              contacts={contacts}
              selectedFriends={selectedFriends}
              toggleFriend={toggleFriend}
              description={description}
              setDescription={setDescription}
              amountStr={amountStr}
              onAmountChange={handleAmountChange}
              date={date}
              setDate={setDate}
              paidById={paidById}
              setPaidById={setPaidById}
              showPayerSelector={showPayerSelector}
              singleFriend={singleFriend ?? null}
              currentUserId={currentUserId}
              loading={loading}
              error={error}
              onSubmit={handleSubmit}
              onClose={handleClose}
            />
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-[0.97] dark:bg-amber-500 dark:hover:bg-amber-400 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add expense
      </button>
      {open && (
        <Modal onClose={handleClose}>
          <FormContent
            contacts={contacts}
            selectedFriends={selectedFriends}
            toggleFriend={toggleFriend}
            description={description}
            setDescription={setDescription}
            amountStr={amountStr}
            onAmountChange={handleAmountChange}
            date={date}
            setDate={setDate}
            paidById={paidById}
            setPaidById={setPaidById}
            showPayerSelector={showPayerSelector}
            singleFriend={singleFriend ?? null}
            currentUserId={currentUserId}
            loading={loading}
            error={error}
            onSubmit={handleSubmit}
            onClose={handleClose}
          />
        </Modal>
      )}
    </>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-stone-900 shadow-2xl max-h-[85vh] overflow-y-auto slide-up">
        {children}
      </div>
    </div>
  );
}

interface FormContentProps {
  contacts: DashboardContact[];
  selectedFriends: Set<string>;
  toggleFriend: (userId: string) => void;
  description: string;
  setDescription: (v: string) => void;
  amountStr: string;
  onAmountChange: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  paidById: string;
  setPaidById: (v: string) => void;
  showPayerSelector: boolean;
  singleFriend: DashboardContact | null;
  currentUserId: string;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}

function FormContent({
  contacts,
  selectedFriends,
  toggleFriend,
  description,
  setDescription,
  amountStr,
  onAmountChange,
  date,
  setDate,
  paidById,
  setPaidById,
  showPayerSelector,
  singleFriend,
  currentUserId,
  loading,
  error,
  onSubmit,
  onClose,
}: FormContentProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-stone-900 dark:text-white">
          Add expense with friends
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Friend selector */}
      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
          Split with
        </label>
        {contacts.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            No contacts yet. Join a group first to see people you can split with.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contacts.map((contact) => {
              const isSelected = selectedFriends.has(contact.userId);
              return (
                <button
                  key={contact.userId}
                  type="button"
                  onClick={() => toggleFriend(contact.userId)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
                  }`}
                >
                  {contact.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={contact.avatarUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm">{contact.emoji ?? "🐦"}</span>
                  )}
                  {formatDisplayName(contact.displayName)}
                  {isSelected && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Description
        </label>
        <Input
          placeholder="Dinner, groceries, etc."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_EXPENSE_DESCRIPTION}
          autoFocus
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Amount
        </label>
        <Input
          placeholder="$0.00"
          value={amountStr ? formatAmountDisplay(amountStr) : ""}
          onChange={(e) => onAmountChange(e.target.value)}
          inputMode="decimal"
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Date
        </label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Payer selector — only when exactly 1 friend selected */}
      {showPayerSelector && singleFriend && (
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Paid by
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaidById(currentUserId)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                paidById === currentUserId
                  ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              }`}
            >
              You
            </button>
            <button
              type="button"
              onClick={() => setPaidById(singleFriend.userId)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                paidById === singleFriend.userId
                  ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              }`}
            >
              {formatDisplayName(singleFriend.displayName)}
            </button>
          </div>
        </div>
      )}

      {/* Split info */}
      {selectedFriends.size > 0 && amountStr && (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Split equally between you and {selectedFriends.size}{" "}
          {selectedFriends.size === 1 ? "friend" : "friends"}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Submit */}
      <Button type="submit" disabled={loading || selectedFriends.size === 0 || !description.trim() || !amountStr}>
        {loading ? "Adding..." : "Add expense"}
      </Button>
    </form>
  );
}
