import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("User")
    .select("displayName, avatarUrl, profilePictureUrl, defaultEmoji")
    .eq("id", user.id)
    .single();

  return (
    <SettingsClient
      email={user.email ?? ""}
      userId={user.id}
      displayName={userData?.displayName ?? user.email ?? ""}
      profilePictureUrl={userData?.profilePictureUrl ?? null}
      avatarUrl={userData?.avatarUrl ?? null}
      defaultEmoji={userData?.defaultEmoji ?? "🦊"}
    />
  );
}
