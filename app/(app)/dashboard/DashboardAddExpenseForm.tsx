"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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
  const [selectedFriend, setSelectedFriend] = useState<DashboardContact | null>(null);
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [paidById, setPaidById] = useState(currentUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typeahead state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeaheadOpen, setTypeaheadOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredContacts = searchQuery.trim()
    ? contacts.filter((c) =>
        c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts;

  // Close dropdown on outside click
  useEffect(() => {
    if (!typeaheadOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setTypeaheadOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [typeaheadOpen]);

  // Reset highlight when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  const resetForm = useCallback(() => {
    setSelectedFriend(null);
    setDescription("");
    setAmountStr("");
    setDate(new Date().toISOString().split("T")[0]!);
    setPaidById(currentUserId);
    setError(null);
    setSearchQuery("");
    setTypeaheadOpen(false);
    setHighlightedIndex(0);
  }, [currentUserId]);

  const handleOpen = useCallback(() => {
    resetForm();
    setOpen(true);
  }, [resetForm]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const selectFriend = useCallback((contact: DashboardContact) => {
    setSelectedFriend(contact);
    setSearchQuery("");
    setTypeaheadOpen(false);
    setPaidById(currentUserId);
  }, [currentUserId]);

  const clearFriend = useCallback(() => {
    setSelectedFriend(null);
    setPaidById(currentUserId);
    setSearchQuery("");
  }, [currentUserId]);

  const handleAmountChange = useCallback((raw: string) => {
    const filtered = filterAmountInput(raw);
    setAmountStr(filtered);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!typeaheadOpen || filteredContacts.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % filteredContacts.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + filteredContacts.length) % filteredContacts.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const contact = filteredContacts[highlightedIndex];
        if (contact) selectFriend(contact);
      } else if (e.key === "Escape") {
        setTypeaheadOpen(false);
      }
    },
    [typeaheadOpen, filteredContacts, highlightedIndex, selectFriend]
  );

  const handleSubmit = async () => {
    if (!selectedFriend) {
      setError("Select a friend to split with.");
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
          friendIds: [selectedFriend.userId],
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

  // Format date nicely for the date pill
  function formatDatePill(dateStr: string): string {
    const today = new Date().toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    const [year, month, day] = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(month!, 10) - 1]} ${parseInt(day!, 10)}, ${year}`;
  }

  const datePillRef = useRef<HTMLInputElement>(null);

  const triggerButton = renderTrigger ? (
    renderTrigger({ onClick: handleOpen, loading })
  ) : (
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
  );

  return (
    <>
      {triggerButton}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-[10vh] sm:pt-4 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          {/* Panel */}
          <div className="modal-content relative w-full max-w-sm rounded-2xl bg-white dark:bg-stone-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-stone-100 dark:border-stone-700/60">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                  Add friend expense
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors dark:hover:text-stone-200 dark:hover:bg-stone-700 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="px-5 py-4 space-y-4"
            >
              {/* Friend selector — typeahead */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                  Split with
                </label>
                {selectedFriend ? (
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-600/50 dark:bg-amber-900/20">
                    {selectedFriend.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedFriend.avatarUrl}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex w-6 h-6 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-200">
                        {selectedFriend.emoji ?? selectedFriend.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="flex-1 text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                      {formatDisplayName(selectedFriend.displayName)}
                    </span>
                    <button
                      type="button"
                      onClick={clearFriend}
                      className="p-0.5 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer"
                      aria-label="Remove friend"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : contacts.length === 0 ? (
                  <p className="text-sm text-stone-400 dark:text-stone-500 py-2">
                    No contacts yet. Join a group first to see people you can split with.
                  </p>
                ) : (
                  <div className="relative">
                    <div className="flex items-center rounded-lg border border-stone-300 dark:border-stone-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-900">
                      <svg className="w-4 h-4 ml-3 text-stone-400 dark:text-stone-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search friends..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setTypeaheadOpen(true);
                        }}
                        onFocus={() => setTypeaheadOpen(true)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-full bg-transparent px-2 py-2 text-base sm:text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none"
                      />
                    </div>
                    {/* Dropdown */}
                    {typeaheadOpen && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-10 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-lg"
                      >
                        {filteredContacts.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-stone-400 dark:text-stone-500">
                            No matches found
                          </p>
                        ) : (
                          filteredContacts.map((contact, i) => (
                            <button
                              key={contact.userId}
                              type="button"
                              onClick={() => selectFriend(contact)}
                              onMouseEnter={() => setHighlightedIndex(i)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                                i === highlightedIndex
                                  ? "bg-amber-50 dark:bg-amber-900/20"
                                  : "hover:bg-stone-50 dark:hover:bg-stone-700/50"
                              }`}
                            >
                              {contact.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={contact.avatarUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-full object-cover"
                                />
                              ) : (
                                <span className="flex w-7 h-7 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300">
                                  {contact.emoji ?? contact.displayName.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                                {formatDisplayName(contact.displayName)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="friendExpenseDescription" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                  Description
                </label>
                <div className="flex items-center rounded-lg border border-stone-300 dark:border-stone-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-900">
                  <input
                    id="friendExpenseDescription"
                    type="text"
                    placeholder="Dinner, groceries, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={MAX_EXPENSE_DESCRIPTION}
                    autoFocus={!!selectedFriend}
                    className="w-full bg-transparent px-3 py-2 text-base sm:text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="friendExpenseAmount" className="block text-sm font-medium text-stone-700 mb-1 dark:text-stone-300">
                  Amount
                </label>
                <div className="flex items-center rounded-lg border border-stone-300 dark:border-stone-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-900">
                  <span className="pl-3 text-sm text-stone-400 dark:text-stone-500 select-none">$</span>
                  <input
                    id="friendExpenseAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountStr ? formatAmountDisplay(amountStr) : ""}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="w-full bg-transparent px-2 py-2 text-base sm:text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date pill */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = datePillRef.current;
                    if (!el) return;
                    if (typeof el.showPicker === "function") {
                      el.showPicker();
                    } else {
                      el.focus();
                      el.click();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-700/60 text-sm font-medium text-stone-700 dark:text-stone-300 cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {formatDatePill(date)}
                </button>
                <input
                  ref={datePillRef}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  tabIndex={-1}
                  aria-label="Expense date"
                  className="sr-only"
                />
              </div>

              {/* Paid by selector */}
              {selectedFriend && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                    Paid by
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaidById(currentUserId)}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                        paidById === currentUserId
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
                      }`}
                    >
                      You
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidById(selectedFriend.userId)}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                        paidById === selectedFriend.userId
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
                      }`}
                    >
                      {formatDisplayName(selectedFriend.displayName)}
                    </button>
                  </div>
                </div>
              )}

              {/* Split info */}
              {selectedFriend && amountStr && (
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  Split equally between you and {formatDisplayName(selectedFriend.displayName)}
                </p>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              {/* Footer actions */}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !selectedFriend || !description.trim() || !amountStr}
                >
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
