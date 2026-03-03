"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton";
import { MAX_EMAIL } from "@/lib/constants";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
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
      router.push(next ?? "/dashboard");
      router.refresh();
    }
  }

  return (
    <>
      <GoogleSignInButton next={next} />

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200 dark:border-stone-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-stone-400 dark:bg-stone-900 dark:text-stone-500">
            or
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5 dark:text-stone-400"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            maxLength={MAX_EMAIL}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-base sm:text-sm text-stone-900 placeholder-stone-400 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-100 dark:placeholder-stone-500"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5 dark:text-stone-400"
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
            className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-base sm:text-sm text-stone-900 placeholder-stone-400 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-100 dark:placeholder-stone-500"
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-amber-600 py-3 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-amber-700 disabled:opacity-50 active:scale-[0.97]"
        >
          {loading ? "Signing in..." : "Sign in →"}
        </button>
      </form>
      <p className="mt-5 text-center text-xs text-stone-400">
        No account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-semibold text-stone-700 transition-colors hover:text-amber-700 dark:text-stone-300 dark:hover:text-amber-400"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50 to-stone-100 p-4 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      <div className="landing-card w-full max-w-sm overflow-hidden rounded-3xl shadow-xl">

        {/* Hero top — matches dashboard gradient card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-stone-700 via-stone-600 to-amber-700 px-8 py-12 sm:py-10 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-4 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-48 -translate-x-1/2 rounded-full bg-stone-300/10 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-3 text-4xl">🕊️</div>
            <h1 className="mb-2 text-2xl font-black tracking-tight">Welcome back.</h1>
            <p className="text-sm text-stone-300/80" style={{ fontFamily: "var(--font-serif-logo)" }}>
              The debts aren&apos;t going to track themselves.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white px-8 py-7 dark:bg-stone-900">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
