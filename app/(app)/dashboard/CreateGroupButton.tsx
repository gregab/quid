"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function CreateGroupButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary").pathname;
    const res = await fetch(`${basePath}/api/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const json = (await res.json()) as { data?: { id: string }; error?: string };

    if (!res.ok || json.error) {
      setError(json.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    setOpen(false);
    setName("");
    setLoading(false);
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setName("");
    setError(null);
  }

  // suppress unused warning — userId will be used in future iterations
  void userId;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-sm font-semibold text-amber-800 shadow-sm transition-all duration-150 hover:bg-amber-100 hover:border-amber-300 hover:shadow active:scale-[0.97] cursor-pointer dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:border-amber-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New group
      </button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Form a new group</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Who's in your next financial friendship?
              </p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Group name
                </label>
                <Input
                  id="groupName"
                  type="text"
                  required
                  placeholder="e.g. Pelican Fund, Crow Situation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
