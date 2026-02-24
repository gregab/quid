import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { MEMBER_EMOJIS } from "@/lib/constants";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ensure a User row exists for this Supabase auth account.
  // This runs as a no-op after the first load; ignoreDuplicates leaves existing records unchanged.
  const avatarUrl =
    (user.user_metadata?.picture as string | undefined) ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    null;

  const defaultEmoji = MEMBER_EMOJIS[Math.floor(Math.random() * MEMBER_EMOJIS.length)]!;

  await supabase.from("User").upsert(
    {
      id: user.id,
      email: user.email!,
      displayName:
        (user.user_metadata?.display_name as string | undefined) ??
        user.email!.split("@")[0]!,
      avatarUrl,
      defaultEmoji,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // Keep avatar fresh for returning users without touching displayName
  if (avatarUrl) {
    await supabase
      .from("User")
      .update({ avatarUrl })
      .eq("id", user.id);
  }

  // Fetch resolved avatar for the nav bar
  const { data: userData } = await supabase
    .from("User")
    .select("profilePictureUrl, avatarUrl, defaultEmoji")
    .eq("id", user.id)
    .single();

  const navAvatarUrl = userData?.profilePictureUrl ?? userData?.avatarUrl ?? null;
  const navEmoji = userData?.defaultEmoji ?? "🦊";

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <Nav email={user.email ?? ""} avatarUrl={navAvatarUrl} defaultEmoji={navEmoji} />
      <main className="max-w-4xl mx-auto px-4 py-5 sm:py-8">{children}</main>
    </div>
  );
}
