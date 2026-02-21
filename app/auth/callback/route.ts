import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.exchangeCodeForSession(code);

    // Ensure a User row exists in Prisma as soon as the email is confirmed.
    // Without this, the user can't be added as a group member until they've
    // visited the app at least once (which triggers the upsert in app layout).
    if (user) {
      await prisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email!,
          displayName:
            (user.user_metadata?.display_name as string | undefined) ??
            user.email!.split("@")[0]!,
        },
        update: {},
      });
    }
  }

  // Redirect to dashboard after confirming email.
  // Use NEXT_PUBLIC_SITE_URL so the redirect stays on the production domain.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/quid";
  return NextResponse.redirect(`${siteUrl}/dashboard`);
}
