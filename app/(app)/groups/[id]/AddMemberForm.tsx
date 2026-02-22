"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface UserResult {
  id: string;
  email: string;
  displayName: string;
}

export function AddMemberForm({
  groupId,
  existingMemberIds,
}: {
  groupId: string;
  existingMemberIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  // Delayed flag so "Searching…" doesn't flash on fast responses
  const [showSearching, setShowSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchingTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setShowResults(false);
        setSearching(false);
        setShowSearching(false);
        if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
        return;
      }

      setSearching(true);
      // Only show "Searching…" if the query takes more than 200ms
      if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
      searchingTimerRef.current = setTimeout(() => setShowSearching(true), 200);

      const supabase = createClient();
      const escaped = q.replace(/%/g, "\\%").replace(/_/g, "\\_");

      // Build the "not in" filter for existing members
      const notInFilter =
        existingMemberIds.length > 0
          ? `(${existingMemberIds.join(",")})`
          : null;

      let queryBuilder = supabase
        .from("User")
        .select("id, email, displayName")
        .or(`displayName.ilike.%${escaped}%,email.ilike.%${escaped}%`)
        .limit(5);

      if (notInFilter) {
        queryBuilder = queryBuilder.not("id", "in", notInFilter);
      }

      const { data } = await queryBuilder;
      if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
      setResults(data ?? []);
      setShowResults(true);
      setHighlightedIndex(-1);
      setSearching(false);
      setShowSearching(false);
    },
    [existingMemberIds],
  );

  function handleInputChange(value: string) {
    setQuery(value);
    setError(null);

    if (selectedUser) {
      setSelectedUser(null);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }

  function selectUser(user: UserResult) {
    setSelectedUser(user);
    setQuery("");
    setResults([]);
    setShowResults(false);
    setError(null);
  }

  function clearSelection() {
    setSelectedUser(null);
    setQuery("");
    setError(null);
    // Focus back on input after clearing
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showResults || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1,
      );
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectUser(results[highlightedIndex]!);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  }

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Determine the email to submit
    const email = selectedUser?.email ?? query.trim();

    if (!email) {
      setError("Please search for a user or enter an email address.");
      return;
    }

    // Basic email validation for raw input (not selected from dropdown)
    if (!selectedUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please select a user from the search results or enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const basePath = new URL(
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary",
      ).pathname;
      const res = await fetch(`${basePath}/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = (await res.json()) as {
        data?: { user: { displayName: string } };
        error?: string;
      };

      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong.");
        return;
      }

      setOpen(false);
      resetState();
      router.refresh();
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetState() {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setSelectedUser(null);
    setError(null);
    setHighlightedIndex(-1);
    setSearching(false);
    setShowSearching(false);
    if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
  }

  function handleClose() {
    setOpen(false);
    resetState();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300 transition-colors cursor-pointer"
      >
        + add member
      </button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Add a member
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Search by name or email address.
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="memberSearch"
                  className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                >
                  Name or email
                </label>

                {selectedUser ? (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                      {selectedUser.displayName}
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="ml-0.5 hover:text-amber-600 dark:hover:text-amber-200 cursor-pointer"
                        aria-label="Clear selection"
                      >
                        ×
                      </button>
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {selectedUser.email}
                    </span>
                  </div>
                ) : (
                  <input
                    id="memberSearch"
                    type="text"
                    autoComplete="off"
                    placeholder="Search by name or email…"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (results.length > 0) setShowResults(true);
                    }}
                    ref={inputRef}
                    className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                  />
                )}

                {/* Reserved space for dropdown results — fixed height so modal doesn't resize */}
                <div className="h-40 mt-2">
                  {showResults && !selectedUser && (
                    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-700 overflow-hidden max-h-40 overflow-y-auto">
                      {results.length > 0 ? (
                        results.map((user, i) => (
                          <button
                            key={user.id}
                            type="button"
                            className={`w-full px-3 py-2 text-left cursor-pointer transition-colors ${
                              i === highlightedIndex
                                ? "bg-amber-50 dark:bg-amber-900/30"
                                : "hover:bg-gray-50 dark:hover:bg-gray-600"
                            }`}
                            onMouseEnter={() => setHighlightedIndex(i)}
                            onClick={() => selectUser(user)}
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.displayName}
                            </div>
                            <div className="text-xs text-gray-400">
                              {user.email}
                            </div>
                          </button>
                        ))
                      ) : showSearching ? (
                        <div className="px-3 py-2 text-sm text-gray-400">
                          Searching…
                        </div>
                      ) : !searching ? (
                        <div className="px-3 py-2 text-sm text-gray-400">
                          No users found
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding…" : "Add member"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
