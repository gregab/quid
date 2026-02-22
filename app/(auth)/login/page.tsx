"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50 to-stone-100 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-stone-950">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl shadow-xl">

        {/* Hero top — matches dashboard gradient card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-stone-700 via-stone-600 to-amber-700 px-8 py-10 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-4 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-48 -translate-x-1/2 rounded-full bg-stone-300/10 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-3 text-4xl">🕊️</div>
            <h1 className="mb-2 text-2xl font-black tracking-tight">Welcome back.</h1>
            <p className="font-mono text-xs text-stone-300/80">
              The flock&apos;s debts aren&apos;t going to roost themselves.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white px-8 py-7 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5 dark:text-gray-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5 dark:text-gray-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-stone-700 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in →"}
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-gray-400">
            No account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-stone-700 transition-colors hover:text-amber-700"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
