import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing Supabase environment variables: ${[
        !url && "NEXT_PUBLIC_SUPABASE_URL",
        !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
      ]
        .filter(Boolean)
        .join(", ")} — add these to your Vercel project environment settings`
    );
  }

  return createBrowserClient<Database>(url, key);
}
