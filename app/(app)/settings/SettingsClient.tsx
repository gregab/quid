"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface GroupBalance {
  groupId: string;
  groupName: string;
  balanceCents: number;
}

export function SettingsClient({ email }: { email: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [groupBalances, setGroupBalances] = useState<GroupBalance[] | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openConfirm() {
    setConfirmOpen(true);
    setConfirmText("");
    setError(null);
    setGroupBalances(null);
    setLoadingBalances(true);

    const res = await fetch(`/api/account`);
    const json = (await res.json()) as {
      data: { groupBalances: GroupBalance[] } | null;
      error?: string;
    };

    setLoadingBalances(false);
    setGroupBalances(json.data?.groupBalances ?? []);
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/account`, { method: "DELETE" });
    const json = (await res.json()) as { data?: { deleted: boolean }; error?: string };

    if (!res.ok || json.error) {
      setError(json.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  function formatBalance(cents: number): string {
    const abs = Math.abs(cents);
    return `$${(abs / 100).toFixed(2)}`;
  }

  const hasOutstandingBalances = (groupBalances ?? []).length > 0;

  return (
    <div className="space-y-8">
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account
        </p>
      </div>

      {/* Account info */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Signed in as <span className="font-medium text-gray-900 dark:text-white">{email}</span>
        </p>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/50 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger zone</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <div className="mt-4">
          <Button variant="danger" onClick={openConfirm}>
            Delete account
          </Button>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setConfirmOpen(false); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete your account?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This will permanently delete your account, remove you from all groups, and erase your data. This cannot be undone.
            </p>

            {loadingBalances ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking balances…
              </div>
            ) : hasOutstandingBalances ? (
              <>
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    You must settle up before deleting your account. Outstanding balances in:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {groupBalances!.map((gb) => (
                      <li key={gb.groupId} className="text-sm text-red-700 dark:text-red-400">
                        <Link
                          href={`/groups/${gb.groupId}`}
                          className="font-medium underline hover:opacity-70 transition-opacity"
                          onClick={() => setConfirmOpen(false)}
                        >
                          {gb.groupName}
                        </Link>:{" "}
                        {gb.balanceCents > 0
                          ? `you are owed ${formatBalance(gb.balanceCents)}`
                          : `you owe ${formatBalance(gb.balanceCents)}`}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-4">
                  <label htmlFor="confirmDelete" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Type <span className="font-bold">FAREWELL</span> to confirm
                  </label>
                  <input
                    id="confirmDelete"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="FAREWELL"
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>

                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="mt-5 flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDelete}
                    disabled={loading || confirmText !== "FAREWELL"}
                  >
                    {loading ? "Deleting..." : "Delete my account"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
