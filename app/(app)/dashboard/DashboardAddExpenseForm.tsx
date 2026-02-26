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
  const [selectedFriend, setSelectedFriend] = useState<DashboardContact | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredContacts = contacts.filter(
    (c) => !searchQuery.trim() || c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  const resetAll = useCallback(() => {
    setPhase("closed");
    setSelectedFriend(null);
    setSearchQuery("");
    setHighlightedIndex(0);
  }, []);

  const handleOpen = useCallback(() => {
    resetAll();
    setPhase("picking");
  }, [resetAll]);

  const selectFriend = useCallback((contact: DashboardContact) => {
    setSelectedFriend(contact);
    setSearchQuery("");
    setPhase("form");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredContacts.length === 0) return;

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
        resetAll();
      }
    },
    [filteredContacts, highlightedIndex, selectFriend, resetAll]
  );

  const handleCustomSubmit = useCallback(
    async (data: ExpenseSubmitData) => {
      if (!selectedFriend) return;

      const res = await fetch("/api/friends/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendIds: [selectedFriend.userId],
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
    [selectedFriend, currentUserId, resetAll, router]
  );

  // Build Member[] for AddExpenseForm
  const members: Member[] = selectedFriend
    ? [
        { userId: currentUserId, displayName: currentUserDisplayName },
        {
          userId: selectedFriend.userId,
          displayName: selectedFriend.displayName,
          emoji: selectedFriend.emoji,
          avatarUrl: selectedFriend.avatarUrl,
        },
      ]
    : [];

  const triggerButton = renderTrigger ? (
    renderTrigger({ onClick: handleOpen, loading: false })
  ) : (
    <button
      type="button"
      onClick={handleOpen}
      className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-sm font-semibold text-amber-800 shadow-sm transition-all duration-150 hover:bg-amber-100 hover:border-amber-300 hover:shadow active:scale-[0.97] cursor-pointer dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:border-amber-600"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      Add expense
    </button>
  );

  // Phase: form — delegate entirely to AddExpenseForm
  if (phase === "form" && selectedFriend) {
    return (
      <>
        {triggerButton}
        <AddExpenseForm
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          members={members}
          onCustomSubmit={handleCustomSubmit}
          renderTrigger={({ onClick }) => {
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

            <div className="px-5 py-4">
              {contacts.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-stone-500 py-2">
                  No contacts yet. Join a group first to see people you can split with.
                </p>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2 dark:text-stone-300">
                    Split with
                  </label>
                  {/* Search input */}
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <svg className="h-4 w-4 text-stone-400 dark:text-stone-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search friends..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 py-2.5 pl-9 pr-3 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
                    />
                  </div>

                  {/* Contact list */}
                  <div className="mt-3 max-h-64 overflow-y-auto -mx-1 rounded-xl">
                    {filteredContacts.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-stone-400 dark:text-stone-500 text-center">
                        No matches found
                      </p>
                    ) : (
                      filteredContacts.map((contact, i) => (
                        <button
                          key={contact.userId}
                          type="button"
                          onClick={() => selectFriend(contact)}
                          onMouseEnter={() => setHighlightedIndex(i)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
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
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex w-9 h-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-sm">
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
                </div>
              )}
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
