import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import Nav from "@/components/Nav";

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
  // This runs as a no-op after the first load; update:{} leaves existing records unchanged.
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Nav email={user.email ?? ""} />
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
