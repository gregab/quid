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
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-semibold text-lg">Quid</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-black underline"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
