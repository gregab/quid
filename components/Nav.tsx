"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Nav({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-2xl text-stone-800 dark:text-stone-200" style={{ fontFamily: "var(--font-serif-logo)" }}>
          Aviary
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block dark:text-gray-400">{email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer dark:text-gray-400 dark:hover:text-white"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
