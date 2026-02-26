"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AddExpenseForm } from "@/app/(app)/groups/[id]/AddExpenseForm";
import type { ExpenseSubmitData } from "@/app/(app)/groups/[id]/AddExpenseForm";
import type { Member } from "@/app/(app)/groups/[id]/ExpensesList";
import { formatDisplayName } from "@/lib/formatDisplayName";

export interface DashboardContact {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  emoji?: string;
}

interface DashboardAddExpenseFormProps {
  currentUserId: string;
  currentUserDisplayName: string;
  contacts: DashboardContact[];
  renderTrigger?: (props: { onClick: () => void; loading: boolean }) => React.ReactNode;
}

export function DashboardAddExpenseForm({
  currentUserId,
  currentUserDisplayName,
  contacts,
  renderTrigger,
}: DashboardAddExpenseFormProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"closed" | "picking" | "form">("closed");
  const [selectedFriends, setSelectedFriends] = useState<DashboardContact[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Typeahead state
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selectedFriends.map((f) => f.userId));
  const filteredContacts = contacts.filter(
    (c) =>
      !selectedIds.has(c.userId) &&
      (!searchQuery.trim() || c.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  const resetAll = useCallback(() => {
    setPhase("closed");
    setSelectedFriends([]);
    setSearchQuery("");
    setDropdownOpen(false);
    setHighlightedIndex(0);
    setError(null);
  }, []);

  const handleOpen = useCallback(() => {
    resetAll();
    setPhase("picking");
  }, [resetAll]);

  const addFriend = useCallback((contact: DashboardContact) => {
    setSelectedFriends((prev) => [...prev, contact]);
    setSearchQuery("");
    setDropdownOpen(false);
    // Re-focus search input after adding
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const removeFriend = useCallback((userId: string) => {
    setSelectedFriends((prev) => prev.filter((f) => f.userId !== userId));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !searchQuery && selectedFriends.length > 0) {
        // Remove last chip
        setSelectedFriends((prev) => prev.slice(0, -1));
        return;
      }

      if (!dropdownOpen || filteredContacts.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % filteredContacts.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + filteredContacts.length) % filteredContacts.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const contact = filteredContacts[highlightedIndex];
        if (contact) addFriend(contact);
      } else if (e.key === "Escape") {
        setDropdownOpen(false);
      }
    },
    [dropdownOpen, filteredContacts, highlightedIndex, addFriend, searchQuery, selectedFriends.length]
  );

  const proceedToForm = useCallback(() => {
    if (selectedFriends.length === 0) {
      setError("Select at least one friend.");
      return;
    }
    setError(null);
    setPhase("form");
  }, [selectedFriends]);

  const handleCustomSubmit = useCallback(
    async (data: ExpenseSubmitData) => {
      const friendIds = selectedFriends.map((f) => f.userId);

      const res = await fetch("/api/friends/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendIds,
          description: data.description,
          amountCents: data.amountCents,
          date: data.date,
          paidById: data.paidById !== currentUserId ? data.paidById : undefined,
          splitType: data.splitType,
          customSplits: data.customSplits,
        }),
      });

      const json = (await res.json()) as { data: unknown; error: string | null };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Something went wrong.");
      }

      resetAll();
      router.refresh();
    },
    [selectedFriends, currentUserId, resetAll, router]
  );

  // Build Member[] for AddExpenseForm from selected friends + current user
  const members: Member[] = [
    { userId: currentUserId, displayName: currentUserDisplayName },
    ...selectedFriends.map((f) => ({
      userId: f.userId,
      displayName: f.displayName,
      emoji: f.emoji,
      avatarUrl: f.avatarUrl,
    })),
  ];

  const triggerButton = renderTrigger ? (
    renderTrigger({ onClick: handleOpen, loading: false })
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

  // Phase: form — delegate entirely to AddExpenseForm
  if (phase === "form") {
    return (
      <>
        {triggerButton}
        <AddExpenseForm
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          members={members}
          onCustomSubmit={handleCustomSubmit}
          renderTrigger={({ onClick }) => {
            // Auto-open: trigger the form immediately
            // We use a hidden element that fires onClick on mount
            return <AutoOpen onClick={onClick} />;
          }}
        />
      </>
    );
  }

  return (
    <>
      {triggerButton}
      {phase === "picking" && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-[10vh] sm:pt-4 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={resetAll}
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
                  onClick={resetAll}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors dark:hover:text-stone-200 dark:hover:bg-stone-700 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Token/chip input */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5 dark:text-stone-300">
                  Split with
                </label>
                {contacts.length === 0 ? (
                  <p className="text-sm text-stone-400 dark:text-stone-500 py-2">
                    No contacts yet. Join a group first to see people you can split with.
                  </p>
                ) : (
                  <div className="relative">
                    {/* Chip container + inline search input */}
                    <div
                      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-2 py-1.5 focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 transition-shadow bg-white dark:bg-stone-900 min-h-[38px] cursor-text"
                      onClick={() => searchInputRef.current?.focus()}
                    >
                      {/* Selected friend chips */}
                      {selectedFriends.map((friend) => (
                        <span
                          key={friend.userId}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-sm font-medium text-amber-800 dark:text-amber-300"
                        >
                          {formatDisplayName(friend.displayName)}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFriend(friend.userId);
                            }}
                            className="ml-0.5 text-amber-600/60 hover:text-amber-800 dark:text-amber-400/60 dark:hover:text-amber-200 transition-colors cursor-pointer"
                            aria-label={`Remove ${formatDisplayName(friend.displayName)}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      {/* Inline search */}
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={selectedFriends.length === 0 ? "Search friends..." : ""}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setDropdownOpen(true);
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="flex-1 min-w-[80px] bg-transparent py-0.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none"
                      />
                    </div>

                    {/* Dropdown */}
                    {dropdownOpen && filteredContacts.length > 0 && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-10 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-lg"
                      >
                        {filteredContacts.map((contact, i) => (
                          <button
                            key={contact.userId}
                            type="button"
                            onClick={() => addFriend(contact)}
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
                        ))}
                      </div>
                    )}
                    {dropdownOpen && searchQuery.trim() && filteredContacts.length === 0 && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-10 top-full mt-1 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-lg"
                      >
                        <p className="px-3 py-3 text-sm text-stone-400 dark:text-stone-500">
                          No matches found
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              {/* Next button */}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-4 py-2 text-sm rounded-xl font-medium transition-all duration-150 cursor-pointer active:scale-[0.97] text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={proceedToForm}
                  disabled={selectedFriends.length === 0}
                  className="px-4 py-2 text-sm rounded-xl font-medium transition-all duration-150 disabled:opacity-50 cursor-pointer active:scale-[0.97] bg-amber-600 text-white hover:bg-amber-700 shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Helper: auto-opens the AddExpenseForm on mount by calling onClick. */
function AutoOpen({ onClick }: { onClick: () => void }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      onClick();
    }
  }, [onClick]);
  return null;
}
