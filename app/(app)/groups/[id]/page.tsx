import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CopyInviteLinkButton } from "./CopyInviteLinkButton";
import { LeaveGroupButton } from "./LeaveGroupButton";
import { GroupInteractive } from "./GroupInteractive";
import type { ExpenseRow, Member } from "./ExpensesList";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { MemberPill, type MemberColor } from "./MemberPill";
import { getUserBalanceCents } from "@/lib/balances/getUserDebt";
import { GroupSettingsButton } from "./GroupSettingsButton";
import { generateGroupPattern } from "@/lib/groupPattern";

// Each member gets a unique color. Full class strings required for Tailwind JIT.
const MEMBER_COLORS: MemberColor[] = [
  { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-sky-100 dark:bg-sky-900/40", text: "text-sky-700 dark:text-sky-300" },
  { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-lime-100 dark:bg-lime-900/40", text: "text-lime-700 dark:text-lime-300" },
  { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-900/40", text: "text-fuchsia-700 dark:text-fuchsia-300" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-pink-100 dark:bg-pink-900/40", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300" },
];

// Hash-based assignment: each member gets a unique value derived from userId + groupId,
// so you get different assignments in different groups. Linear probing for collisions,
// processed in hash order for stability.
function assignMemberValues<T>(
  userIds: string[],
  groupId: string,
  palette: T[]
): Map<string, T> {
  const hash = (uid: string) =>
    (uid + groupId).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const sorted = [...userIds].sort((a, b) => hash(a) - hash(b));
  const used = new Set<number>();
  const result = new Map<string, T>();
  for (const uid of sorted) {
    let idx = hash(uid) % palette.length;
    while (used.has(idx)) idx = (idx + 1) % palette.length;
    used.add(idx);
    result.set(uid, palette[idx]!);
  }
  return result;
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch group with members (and their User data)
  const { data: group } = await supabase
    .from("Group")
    .select("*, GroupMember(*, User(*))")
    .eq("id", id)
    .single();

  if (!group) redirect("/dashboard");

  // Sort members by joinedAt
  const groupMembers = (group.GroupMember ?? []).sort(
    (a, b) => a.joinedAt.localeCompare(b.joinedAt)
  );

  const memberColorMap = assignMemberValues(groupMembers.map((m) => m.userId), id, MEMBER_COLORS);
  const isMember = groupMembers.some((m) => m.userId === user.id);
  if (!isMember) redirect("/dashboard");

  // Fetch expenses with paidBy user, splits, and recurring template info
  const { data: expenses } = await supabase
    .from("Expense")
    .select("*, User!paidById(*), ExpenseSplit(*, User(displayName)), RecurringExpense(id, frequency)")
    .eq("groupId", id)
    .order("date", { ascending: false })
    .order("createdAt", { ascending: false });

  // Fetch activity logs with actor — limit to 20; more can be paged in client-side.
  const { data: activityLogs } = await supabase
    .from("ActivityLog")
    .select("*, User!actorId(displayName)")
    .eq("groupId", id)
    .order("createdAt", { ascending: false })
    .limit(20);

  // Transform activity logs to match the shape expected by GroupInteractive
  // (Prisma returned { actor: { displayName } }, Supabase returns { User: { displayName } })
  const transformedLogs = (activityLogs ?? []).map((log) => ({
    ...log,
    actor: log.User ?? { displayName: "Unknown" },
  }));

  const currentMember = groupMembers.find((m) => m.userId === user.id);
  const currentUserDisplayName = currentMember?.User?.displayName ?? user.email ?? "You";

  // Build a display-name map for ALL users referenced in this group's expenses,
  // including members who have since left or deleted their accounts.
  const allUserNames: Record<string, string> = {};
  for (const m of groupMembers) {
    if (m.User) allUserNames[m.userId] = m.User.displayName;
  }
  for (const expense of expenses ?? []) {
    if (expense.User) allUserNames[expense.paidById] = expense.User.displayName;
    for (const split of expense.ExpenseSplit ?? []) {
      const name = (split as { User?: { displayName: string } | null }).User?.displayName;
      if (name) allUserNames[split.userId] = name;
    }
  }

  const members: Member[] = groupMembers.map((m) => ({
    userId: m.userId,
    displayName: m.User!.displayName,
    emoji: m.User!.defaultEmoji,
    color: memberColorMap.get(m.userId)!,
    avatarUrl: m.User!.profilePictureUrl ?? m.User!.avatarUrl,
  }));

  const initialExpenses: ExpenseRow[] = (expenses ?? []).map((expense) => {
    const expenseSplits = (expense.ExpenseSplit ?? []).map((s) => ({
      userId: s.userId,
      amountCents: s.amountCents,
    }));
    return {
      id: expense.id,
      description: expense.description,
      amountCents: expense.amountCents,
      date: expense.date.split("T")[0]!,
      paidById: expense.paidById,
      paidByDisplayName: expense.User?.displayName ?? "Unknown",
      participantIds: expenseSplits.map((s) => s.userId),
      splits: expenseSplits,
      splitType: (expense.splitType as "equal" | "custom") ?? "equal",
      canEdit: expense.isPayment || expense.recurringExpenseId ? false : expense.createdById === user.id,
      canDelete: expense.createdById === user.id,
      isPayment: expense.isPayment,
      settledUp: expense.settledUp ?? false,
      createdById: expense.createdById ?? undefined,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      recurringExpense: expense.RecurringExpense
        ? {
            id: expense.RecurringExpense.id,
            frequency: expense.RecurringExpense.frequency as "weekly" | "monthly" | "yearly",
          }
        : null,
    };
  });

  // Compute the user's outstanding balance (absolute value — block leaving if nonzero)
  const userOutstandingCents = Math.abs(getUserBalanceCents(
    initialExpenses.map((e) => ({
      paidById: e.paidById,
      splits: e.splits,
    })),
    user.id
  ));

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header + Members */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-amber-700 mb-3 transition-colors py-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to groups
        </Link>

        {/* Banner hero (only when a banner is set) */}
        {group.bannerUrl && (
          <div className="relative mb-4 overflow-hidden rounded-2xl h-32 sm:h-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={group.bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
              <h1 className="text-xl sm:text-2xl font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                {group.name}
              </h1>
            </div>
            <div className="absolute top-3 right-3">
              <GroupSettingsButton
                groupId={group.id}
                currentGroupName={group.name}
                currentBannerUrl={group.bannerUrl ?? null}
                onBanner
              />
            </div>
          </div>
        )}

        {/* Pattern banner (no uploaded banner) */}
        {!group.bannerUrl && (() => {
          const { lightSvg, darkSvg } = generateGroupPattern(group.patternSeed, 800);
          // Make SVGs fill container: replace fixed dimensions with 100% and use slice to cover
          const makeFill = (svg: string) =>
            svg
              .replace(/width="\d+"/, 'width="100%"')
              .replace(/height="\d+"/, 'height="100%"')
              .replace('viewBox=', 'preserveAspectRatio="xMidYMid slice" viewBox=');
          return (
            <div className="relative mb-4 overflow-hidden rounded-2xl h-32 sm:h-40">
              <div
                className="absolute inset-0 dark:hidden"
                dangerouslySetInnerHTML={{ __html: makeFill(lightSvg) }}
              />
              <div
                className="absolute inset-0 hidden dark:block"
                dangerouslySetInnerHTML={{ __html: makeFill(darkSvg) }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                <h1 className="text-xl sm:text-2xl font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                  {group.name}
                </h1>
              </div>
              <div className="absolute top-3 right-3">
                <GroupSettingsButton
                  groupId={group.id}
                  currentGroupName={group.name}
                  currentBannerUrl={group.bannerUrl ?? null}
                  onBanner
                />
              </div>
            </div>
          );
        })()}

        {/* Member chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {groupMembers.map((m) => (
            <MemberPill
              key={m.id}
              name={formatDisplayName(m.User!.displayName)}
              emoji={m.User!.defaultEmoji}
              color={memberColorMap.get(m.userId)}
              suffix={m.userId === user.id ? "· you" : undefined}
              title={m.User?.email ?? undefined}
              avatarUrl={m.User!.profilePictureUrl ?? m.User!.avatarUrl}
            />
          ))}
          <CopyInviteLinkButton inviteToken={group.inviteToken} />
        </div>
      </div>

      {/* Expenses, Activity, and Balances (client component with optimistic updates) */}
      <GroupInteractive
        groupId={group.id}
        groupCreatedById={group.createdById}
        currentUserId={user.id}
        currentUserDisplayName={currentUserDisplayName}
        initialExpenses={initialExpenses}
        initialLogs={transformedLogs}
        hasMoreLogs={(activityLogs?.length ?? 0) >= 20}
        members={members}
        allUserNames={allUserNames}
        inviteToken={group.inviteToken}
      />

      <div className="flex items-center justify-between pt-4">
        <LeaveGroupButton groupId={group.id} userOutstandingCents={userOutstandingCents} />
      </div>
    </div>
  );
}
