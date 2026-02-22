import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/aviary";

  // Guard against open redirects: only allow clean relative paths.
  // Reject "//evil.com" (protocol-relative) and anything with a protocol.
  const isSafePath = (p: string) =>
    p.startsWith("/") && !p.startsWith("//") && !p.includes("://");

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.exchangeCodeForSession(code);

    // Ensure a User row exists as soon as the email is confirmed.
    // Without this, the user can't be added as a group member until they've
    // visited the app at least once (which triggers the upsert in app layout).
    if (user) {
      await supabase.from("User").upsert(
        {
          id: user.id,
          email: user.email!,
          displayName:
            (user.user_metadata?.display_name as string | undefined) ??
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            user.email!.split("@")[0]!,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

      // If the user arrived via an invite link, auto-join the group so they
      // land on the group page without a separate manual "Join" click.
      if (next && isSafePath(next)) {
        const inviteMatch = next.match(/^\/invite\/([^/?#]+)/);
        if (inviteMatch) {
          const token = inviteMatch[1];
          const { data: joinData } = await supabase.rpc("join_group_by_token", {
            _token: token,
          });
          if (joinData) {
            const { groupId } = joinData as { groupId: string; alreadyMember: boolean };
            return NextResponse.redirect(`${siteUrl}/groups/${groupId}`);
          }
          // Token was invalid — fall through to redirect to the invite page
          // so the user sees the "Invalid invite link" error.
          return NextResponse.redirect(`${siteUrl}${next}`);
        }
      }
    }
  }

  // Respect a ?next= destination for non-invite paths (e.g. returning to a
  // protected page after login-triggered email re-confirmation).
  if (next && isSafePath(next)) {
    return NextResponse.redirect(`${siteUrl}${next}`);
  }

  return NextResponse.redirect(`${siteUrl}/dashboard`);
}
