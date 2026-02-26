import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateGroupButton from "./CreateGroupButton";
import { DashboardAddExpenseForm } from "./DashboardAddExpenseForm";
import type { DashboardContact } from "./DashboardAddExpenseForm";
import { getUserBalanceCents } from "@/lib/balances/getUserDebt";
import { formatCents } from "@/lib/format";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { GroupThumbnail } from "@/components/GroupThumbnail";
import { InstallPrompt } from "@/components/InstallPrompt";
import { BIRD_FACTS } from "@aviary/shared";


export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch groups the user is a member of, with the Group relation
  const { data: memberships } = await supabase
    .from("GroupMember")
    .select("*, Group(*)")
    .eq("userId", user.id);

  // Sort by group createdAt descending (Supabase doesn't support ordering by joined relation)
  const allGroups = (memberships ?? [])
    .map((m) => m.Group!)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Split into regular groups and friend groups
  const regularGroups = allGroups.filter((g) => !g.isFriendGroup);
  const friendGroupList = allGroups.filter((g) => g.isFriendGroup);

  // Fetch member counts per group
  const memberCountMap = new Map<string, number>();
  if (allGroups.length > 0) {
    const { data: allMembers } = await supabase
      .from("GroupMember")
      .select("groupId")
      .in("groupId", allGroups.map((g) => g.id));
    for (const m of allMembers ?? []) {
      memberCountMap.set(m.groupId, (memberCountMap.get(m.groupId) ?? 0) + 1);
    }
  }

  // Fetch expenses with splits for balance computation
  const balanceMap = new Map<string, number>();
  const groupsWithExpenses = new Set<string>();
  if (allGroups.length > 0) {
    const { data: expenses } = await supabase
      .from("Expense")
      .select("groupId, paidById, ExpenseSplit(userId, amountCents)")
      .in("groupId", allGroups.map((g) => g.id));
    if (expenses) {
      // Group expenses by groupId
      const byGroup = new Map<string, Array<{ paidById: string; splits: Array<{ userId: string; amountCents: number }> }>>();
      for (const e of expenses) {
        const gId = e.groupId;
        groupsWithExpenses.add(gId);
        if (!byGroup.has(gId)) byGroup.set(gId, []);
        byGroup.get(gId)!.push({
          paidById: e.paidById,
          splits: (e.ExpenseSplit ?? []) as Array<{ userId: string; amountCents: number }>,
        });
      }
      for (const [gId, exps] of byGroup) {
        balanceMap.set(gId, getUserBalanceCents(exps, user.id));
      }
    }
  }

  // For friend groups: fetch members to identify the "friend" (the other person)
  interface FriendInfo {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    emoji: string | null;
    groupId: string;
    balance: number;
    hasExpenses: boolean;
  }
  const friends: FriendInfo[] = [];

  if (friendGroupList.length > 0) {
    const { data: friendMembers } = await supabase
      .from("GroupMember")
      .select("groupId, userId, User(displayName, avatarUrl, profilePictureUrl, defaultEmoji)")
      .in("groupId", friendGroupList.map((g) => g.id));

    for (const fg of friendGroupList) {
      const members = (friendMembers ?? []).filter((m) => m.groupId === fg.id);
      const friend = members.find((m) => m.userId !== user.id);
      if (friend?.User) {
        friends.push({
          userId: friend.userId,
          displayName: friend.User.displayName,
          avatarUrl: friend.User.profilePictureUrl ?? friend.User.avatarUrl,
          emoji: friend.User.defaultEmoji,
          groupId: fg.id,
          balance: balanceMap.get(fg.id) ?? 0,
          hasExpenses: groupsWithExpenses.has(fg.id),
        });
      }
    }
  }

  // Build contacts: all unique users across ALL groups (excluding self)
  const contacts: DashboardContact[] = [];
  if (allGroups.length > 0) {
    const { data: contactMembers } = await supabase
      .from("GroupMember")
      .select("userId, User(displayName, avatarUrl, profilePictureUrl, defaultEmoji)")
      .in("groupId", allGroups.map((g) => g.id));

    const seen = new Set<string>();
    for (const m of contactMembers ?? []) {
      if (m.userId === user.id || seen.has(m.userId)) continue;
      seen.add(m.userId);
      if (m.User) {
        contacts.push({
          userId: m.userId,
          displayName: m.User.displayName,
          avatarUrl: m.User.profilePictureUrl ?? m.User.avatarUrl,
          emoji: m.User.defaultEmoji,
        });
      }
    }
    contacts.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "friend";

  // Overall balance across all groups (for summary display)
  const totalBalance = allGroups.reduce((sum, g) => sum + (balanceMap.get(g.id) ?? 0), 0);
  const hasAnyExpenses = groupsWithExpenses.size > 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl">
        <img
          src="/birds.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/40 to-stone-900/20" />
        <div className="relative z-10 px-6 sm:px-8 pt-16 sm:pt-24 pb-6 sm:pb-8">
          <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
            Hey {displayName}.
          </h1>
          {hasAnyExpenses && (
            <p className="mt-1.5 text-base sm:text-lg font-medium text-white/90 drop-shadow-sm">
              Right now, you {totalBalance >= 0 ? "are owed" : "owe"}{" "}
              <span className={totalBalance > 0 ? "font-bold text-emerald-300" : "font-bold text-white"}>
                {formatCents(Math.abs(totalBalance))}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Groups section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl sm:text-lg font-bold tracking-tight text-stone-900 dark:text-white">Your groups</h2>
            <CreateGroupButton userId={user.id} />
          </div>
        </div>

        {regularGroups.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-br from-amber-50/60 via-stone-50 to-white px-5 py-12 sm:px-8 sm:py-16 text-center dark:border-stone-700/50 dark:from-amber-950/20 dark:via-stone-900/40 dark:to-stone-900/20">
            {/* Decorative background texture */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
            <div className="relative">
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
                style={{ background: "linear-gradient(135deg, #b45309, #92400e)" }}
              >
                <span className="text-2xl text-white" style={{ fontFamily: "var(--font-serif-logo)" }}>A</span>
              </div>
              <p className="mb-1.5 text-xl sm:text-lg font-bold text-stone-800 dark:text-stone-200">Welcome to the nest</p>
              <p className="mx-auto mb-7 max-w-xs text-base sm:text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                Start a group to split expenses with friends, roommates, or travel buddies.
              </p>
              <div className="flex flex-col items-center gap-3">
                <CreateGroupButton userId={user.id} variant="large" />
                <p className="text-sm sm:text-xs text-stone-500 dark:text-stone-400">
                  Or ask a friend for an invite link to join theirs
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {regularGroups.map((group, i) => {
              const memberCount = memberCountMap.get(group.id) ?? 0;
              const balance = balanceMap.get(group.id) ?? 0;
              const hasExpenses = groupsWithExpenses.has(group.id);

              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  prefetch={false}
                  className={`group-card group flex items-center gap-3 py-3.5 transition-colors duration-150 hover:bg-stone-50 dark:hover:bg-stone-900/50 -mx-2 px-2${i < regularGroups.length - 1 ? " border-b border-stone-100 dark:border-stone-800/60" : ""}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Thumbnail */}
                  <GroupThumbnail patternSeed={group.patternSeed} bannerUrl={group.bannerUrl} />

                  {/* Left: group info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base sm:text-[15px] font-semibold text-stone-900 dark:text-white">
                      {group.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-400 dark:text-stone-500">
                      <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                      <span className="text-stone-300 dark:text-stone-700">&middot;</span>
                      <span>
                        {new Date(group.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Right: balance + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {balance !== 0 && (
                      <div className="text-right">
                        <p className={`text-[11px] ${
                          balance > 0
                            ? "text-emerald-600/70 dark:text-emerald-400/70"
                            : "text-rose-600/70 dark:text-rose-400/70"
                        }`}>
                          {balance > 0 ? "you are owed" : "you owe"}
                        </p>
                        <p className={`text-sm font-semibold ${
                          balance > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {formatCents(Math.abs(balance))}
                        </p>
                      </div>
                    )}
                    {balance === 0 && hasExpenses && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          settled
                        </p>
                      </div>
                    )}
                    <svg
                      className="h-4 w-4 text-stone-300 dark:text-stone-600 transition-transform duration-150 group-hover:translate-x-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Friends section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl sm:text-lg font-bold tracking-tight text-stone-900 dark:text-white">Friends</h2>
            <DashboardAddExpenseForm currentUserId={user.id} contacts={contacts} />
          </div>
        </div>

        {friends.filter((f) => f.hasExpenses).length === 0 ? (
          <div className="rounded-2xl border border-stone-200/60 bg-stone-50/50 px-5 py-8 text-center dark:border-stone-700/40 dark:bg-stone-900/20">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {contacts.length > 0
                ? "Add an expense with a friend to start tracking debts individually."
                : "Join a group with others to start adding friend expenses."}
            </p>
          </div>
        ) : (
            <div>
              {friends.filter((f) => f.hasExpenses).map((friend, i, arr) => (
                <Link
                  key={friend.groupId}
                  href={`/groups/${friend.groupId}`}
                  prefetch={false}
                  className={`group-card group flex items-center gap-3 py-3.5 transition-colors duration-150 hover:bg-stone-50 dark:hover:bg-stone-900/50 -mx-2 px-2${i < arr.length - 1 ? " border-b border-stone-100 dark:border-stone-800/60" : ""}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Avatar */}
                  {friend.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={friend.avatarUrl}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <span className="text-lg">{friend.emoji ?? "🐦"}</span>
                    </div>
                  )}

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base sm:text-[15px] font-semibold text-stone-900 dark:text-white">
                      {formatDisplayName(friend.displayName)}
                    </p>
                  </div>

                  {/* Balance + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {friend.balance !== 0 && (
                      <div className="text-right">
                        <p className={`text-[11px] ${
                          friend.balance > 0
                            ? "text-emerald-600/70 dark:text-emerald-400/70"
                            : "text-rose-600/70 dark:text-rose-400/70"
                        }`}>
                          {friend.balance > 0 ? "you are owed" : "you owe"}
                        </p>
                        <p className={`text-sm font-semibold ${
                          friend.balance > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {formatCents(Math.abs(friend.balance))}
                        </p>
                      </div>
                    )}
                    {friend.balance === 0 && friend.hasExpenses && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          settled
                        </p>
                      </div>
                    )}
                    <svg
                      className="h-4 w-4 text-stone-300 dark:text-stone-600 transition-transform duration-150 group-hover:translate-x-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      {/* PWA install prompt — mobile only, hidden if already using PWA */}
      <InstallPrompt />

      {/* Bird fact — subtle editorial aside */}
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/60 bg-stone-50/80 px-5 py-4 dark:border-stone-700/40 dark:bg-stone-900/30">
        <p className="text-xs sm:text-[11px] font-bold uppercase tracking-[0.15em] text-amber-700/80 dark:text-amber-400/70">
          Bird fact
        </p>
        <p className="mt-1.5 text-lg sm:text-base leading-relaxed text-stone-700 dark:text-stone-300" style={{ fontFamily: "var(--font-serif-logo)" }}>
          {BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)]}
        </p>
      </div>

      {/* Support + Legal links */}
      <div className="pb-4 text-center text-sm sm:text-xs text-stone-500 dark:text-stone-400 space-y-1">
        <p>
          <a
            href="https://buymeacoffee.com/gregbigelow"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
          >
            Like Aviary? Buy me a coffee.
          </a>
        </p>
        <p>
          <Link href="/privacy" className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors">Privacy Policy</Link>
          <span className="mx-2 text-stone-300 dark:text-stone-700">&middot;</span>
          <Link href="/terms" className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
