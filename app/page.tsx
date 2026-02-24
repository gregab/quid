import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 via-amber-50 to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      {/* Main content */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {/* Hero card */}
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <div className="relative overflow-hidden bg-gradient-to-br from-stone-700 via-stone-600 to-amber-700 px-8 py-14 text-white">
              <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-4 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
              <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-48 -translate-x-1/2 rounded-full bg-stone-300/10 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-4 text-5xl">🕊️</div>
                <h1 className="mb-3 text-3xl font-black tracking-tight">
                  Aviary
                </h1>
                <p className="text-sm text-stone-200">
                  Split expenses with your group. Track who owes what, settle up
                  simply, and enjoy your life.
                </p>
              </div>
            </div>

            <div className="bg-white px-8 py-8 dark:bg-stone-900">
              {user ? (
                <Link
                  href="/dashboard"
                  className="block w-full rounded-xl bg-stone-800 py-2.5 text-center text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-stone-700"
                >
                  Go to Dashboard &rarr;
                </Link>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/login"
                    className="block w-full rounded-xl bg-stone-800 py-2.5 text-center text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-stone-700"
                  >
                    Log in &rarr;
                  </Link>
                  <Link
                    href="/signup"
                    className="block w-full rounded-xl border border-stone-200 py-2.5 text-center text-sm font-bold text-stone-700 shadow-sm transition-all duration-150 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-stone-400 dark:text-stone-500">
        <Link
          href="/privacy"
          className="transition-colors hover:text-stone-600 dark:hover:text-stone-300"
        >
          Privacy Policy
        </Link>
        <span className="mx-2">&middot;</span>
        <Link
          href="/terms"
          className="transition-colors hover:text-stone-600 dark:hover:text-stone-300"
        >
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
