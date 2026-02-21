import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to dashboard after confirming email.
  // Use NEXT_PUBLIC_SITE_URL so the redirect stays on the production domain.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid";
  return NextResponse.redirect(`${siteUrl}/dashboard`);
}
