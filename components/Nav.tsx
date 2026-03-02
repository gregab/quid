"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FeedbackModal } from "@/components/FeedbackModal";

interface NavProps {
  email: string;
  avatarUrl?: string | null;
  defaultEmoji?: string;
}

export default function Nav({ email, avatarUrl, defaultEmoji }: NavProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const showAvatar = avatarUrl && !imgError;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 shadow-sm backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/80">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-2xl text-stone-800 dark:text-stone-200 hover:opacity-70 transition-opacity" style={{ fontFamily: "var(--font-serif-logo)" }}>
          Aviary
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-sm text-stone-500 hidden sm:block dark:text-stone-400 truncate max-w-[200px]">{email}</span>
          <Link
            href="/settings"
            className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-stone-950 transition-all"
            aria-label="Settings"
          >
            {showAvatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-base dark:bg-amber-900/40">
                {defaultEmoji ?? "🦊"}
              </span>
            )}
          </Link>
          <FeedbackModal />
          <button
            onClick={handleLogout}
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors cursor-pointer dark:text-stone-400 dark:hover:text-white"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
