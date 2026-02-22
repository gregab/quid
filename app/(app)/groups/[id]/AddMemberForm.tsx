"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AddMemberForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary").pathname;
    const res = await fetch(`${basePath}/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const json = (await res.json()) as {
      data?: { user: { displayName: string } };
      error?: string;
    };

    setLoading(false);

    if (!res.ok || json.error) {
      setError(json.error ?? "Something went wrong.");
      return;
    }

    setOpen(false);
    setEmail("");
    setError(null);
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setEmail("");
    setError(null);
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
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add a member</h2>
              <p className="text-sm text-gray-400 mt-0.5">Invite someone by their email address.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="memberEmail" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Email address
                </label>
                <Input
                  id="memberEmail"
                  type="email"
                  required
                  placeholder="flamingo@flamboyance.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
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
