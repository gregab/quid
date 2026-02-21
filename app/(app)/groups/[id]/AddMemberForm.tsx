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
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/groups/${groupId}/members`, {
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

    setSuccess(`${json.data?.user.displayName ?? email} added to the group.`);
    setEmail("");
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setEmail("");
    setError(null);
    setSuccess(null);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="text-sm">
        Add member
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Add a member</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="memberEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <Input
                  id="memberEmail"
                  type="email"
                  required
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Close
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add member"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
