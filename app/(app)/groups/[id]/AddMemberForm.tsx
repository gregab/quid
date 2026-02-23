"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function AddMemberForm({
  groupId,
}: {
  groupId: string;
  existingMemberIds?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter an email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
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
      setEmail("");
      setError(null);
      router.refresh();
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
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
                Enter their email address.
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="memberEmail"
                  className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                >
                  Email
                </label>
                <input
                  id="memberEmail"
                  type="email"
                  autoComplete="off"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-amber-400 dark:focus:border-amber-400 transition-shadow dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

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
