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

    const basePath = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid").pathname;
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
      <Button onClick={() => setOpen(true)}>+ New group</Button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Form a new group</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Who's in your next financial friendship?
              </p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                  Group name
                </label>
                <Input
                  id="groupName"
                  type="text"
                  required
                  placeholder="e.g. The Italy Situation, Dinner Club, Who Got the Uber?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
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
