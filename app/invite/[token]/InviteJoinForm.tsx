"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function InviteJoinForm({
  token,
  groupName,
  memberCount,
  isAuthenticated,
}: {
  token: string;
  groupName: string;
  memberCount: number;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/invite/${token}/join`, {
        method: "POST",
      });

      const json = (await res.json()) as {
        data?: { groupId: string; alreadyMember: boolean };
        error?: string;
      };

      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      router.push(`/groups/${json.data.groupId}`);
    } catch {
      setError("Network error — please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50 to-stone-100 p-4 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl shadow-xl">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-stone-700 via-stone-600 to-amber-700 px-8 py-10 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-4 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-3 text-4xl">🕊️</div>
            <h1 className="mb-1 text-2xl font-black tracking-tight">You&apos;re invited!</h1>
            <p className="text-sm text-stone-200/80">Join the group and start splitting expenses.</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white px-8 py-7 dark:bg-stone-900">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1">
              Group
            </p>
            <p className="text-xl font-bold text-stone-900 dark:text-white">{groupName}</p>
            <p className="text-sm text-stone-400 mt-0.5">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-600 mb-4">{error}</p>
          )}

          {isAuthenticated ? (
            <Button
              onClick={handleJoin}
              disabled={loading}
              className="w-full justify-center"
            >
              {loading ? "Joining…" : `Join ${groupName}`}
            </Button>
          ) : (
            <div className="space-y-3">
              <Link
                href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                className="block w-full rounded-xl bg-stone-800 py-2.5 text-center text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-stone-700"
              >
                Sign in to join
              </Link>
              <p className="text-center text-xs text-stone-400">
                No account?{" "}
                <Link
                  href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="font-semibold text-stone-700 hover:text-amber-700"
                >
                  Sign up
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
