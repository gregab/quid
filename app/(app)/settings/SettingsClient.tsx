"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface GroupBalance {
  groupId: string;
  groupName: string;
  balanceCents: number;
}

export function SettingsClient({
  email,
  groupBalances,
}: {
  email: string;
  groupBalances: GroupBalance[];
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary").pathname;
  const hasOutstandingBalances = groupBalances.length > 0;

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const res = await fetch(`${basePath}/api/account`, {
      method: "DELETE",
    });

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

  return (
    <div className="space-y-8">
      <div>
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
          <Button
            variant="danger"
            onClick={() => { setConfirmOpen(true); setConfirmText(""); setError(null); }}
          >
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

            {hasOutstandingBalances && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  You have outstanding balances:
                </p>
                <ul className="mt-2 space-y-1">
                  {groupBalances.map((gb) => (
                    <li key={gb.groupId} className="text-sm text-amber-700 dark:text-amber-400">
                      <span className="font-medium">{gb.groupName}</span>:{" "}
                      {gb.balanceCents > 0
                        ? `you are owed ${formatBalance(gb.balanceCents)}`
                        : `you owe ${formatBalance(gb.balanceCents)}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="confirmDelete" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type <span className="font-bold">DELETE</span> to confirm
              </label>
              <input
                id="confirmDelete"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="DELETE"
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
                disabled={loading || confirmText !== "DELETE" || hasOutstandingBalances}
              >
                {loading ? "Deleting..." : "Delete my account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
