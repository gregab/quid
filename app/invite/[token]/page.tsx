import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InviteJoinForm } from "./InviteJoinForm";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;

  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_group_by_invite_token", { _token: token });

    if (data) {
      const group = data as { id: string; name: string; memberCount: number; isMember: boolean };
      const title = `Join ${group.name} on Aviary`;
      const description = `You've been invited to join ${group.name}. Aviary is a friendly expense splitting app — track shared costs with ease and joy.`;

      const ogImage = {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Aviary — Friendly Expense Splitting",
      };

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          siteName: "Friendly expense splitting",
          images: [ogImage],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [{ url: "/og-image.jpg", alt: "Aviary — Friendly Expense Splitting" }],
        },
      };
    }
  } catch {
    // fall through to default
  }

  const ogImage = {
    url: "/og-image.jpg",
    width: 1200,
    height: 630,
    alt: "Aviary — Friendly Expense Splitting",
  };

  return {
    title: "You've been invited — Aviary",
    description: "Aviary is a friendly expense splitting app. Join a group to start tracking shared costs.",
    openGraph: {
      title: "You've been invited — Aviary",
      description: "Aviary is a friendly expense splitting app. Join a group to start tracking shared costs.",
      siteName: "Friendly expense splitting",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: "You've been invited — Aviary",
      description: "Aviary is a friendly expense splitting app. Join a group to start tracking shared costs.",
      images: [{ url: "/og-image.jpg", alt: "Aviary — Friendly Expense Splitting" }],
    },
  };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("get_group_by_invite_token", { _token: token });

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50 to-stone-100 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-stone-950">
        <div className="text-center">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid invite link</h1>
          <p className="text-sm text-gray-500 mb-6">This invite link is invalid or has been reset.</p>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            ← Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const group = data as { id: string; name: string; memberCount: number; isMember: boolean };

  if (group.isMember) {
    redirect(`/groups/${group.id}`);
  }

  return (
    <InviteJoinForm
      token={token}
      groupName={group.name}
      memberCount={group.memberCount}
      isAuthenticated={!!user}
    />
  );
}
