"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary").pathname;

  async function handleLeave() {
    setLoading(true);
    setError(null);

    const res = await fetch(`${basePath}/api/groups/${groupId}/members`, {
      method: "DELETE",
    });

    const json = (await res.json()) as { data?: { deletedGroup: boolean }; error?: string };

    if (!res.ok || json.error) {
      setError(json.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <>
      <button
        onClick={() => { setConfirmOpen(true); setError(null); }}
        className="text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer dark:text-gray-400"
        aria-label="Leave group"
      >
        Leave group
      </button>

      {confirmOpen && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setConfirmOpen(false); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 mb-1 dark:text-white">Leave group?</h2>
            <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">
              You&apos;ll no longer see this group or its expenses. If you&apos;re the last member, the group will be deleted.
            </p>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleLeave} disabled={loading}>
                {loading ? "Leaving..." : "Leave"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
