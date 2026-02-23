import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm } from "./AddMemberForm";
import { CopyInviteLinkButton } from "./CopyInviteLinkButton";
import { LeaveGroupButton } from "./LeaveGroupButton";
import { GroupInteractive } from "./GroupInteractive";
import type { ExpenseRow, Member } from "./ExpensesList";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { MemberPill, type MemberColor } from "./MemberPill";

// None of these overlap with GROUP_EMOJIS in dashboard/page.tsx
const MEMBER_EMOJIS = [
  "🦊", "🐼", "🧙", "🦄", "🐬", "🦁", "🐙", "🐢", "🦝", "🐻",
  "🐺", "🐲", "🦈", "🐸", "🦇", "🐿️", "🐨", "🐯", "🦦",
  "🦥", "🦔", "🐵", "🦋", "🐱",
];

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

  const memberEmojiMap = assignMemberValues(groupMembers.map((m) => m.userId), id, MEMBER_EMOJIS);
  const memberColorMap = assignMemberValues(groupMembers.map((m) => m.userId), id, MEMBER_COLORS);
  const isMember = groupMembers.some((m) => m.userId === user.id);
  if (!isMember) redirect("/dashboard");

  // Fetch expenses with paidBy user and splits (including split participants' display names)
  const { data: expenses } = await supabase
    .from("Expense")
    .select("*, User!paidById(*), ExpenseSplit(*, User(displayName))")
    .eq("groupId", id)
    .order("date", { ascending: false });

  // Fetch activity logs with actor
  const { data: activityLogs } = await supabase
    .from("ActivityLog")
    .select("*, User!actorId(displayName)")
    .eq("groupId", id)
    .order("createdAt", { ascending: false })
    .limit(50);

  // Transform activity logs to match the shape expected by GroupInteractive
  // (Prisma returned { actor: { displayName } }, Supabase returns { User: { displayName } })
  const transformedLogs = (activityLogs ?? []).map((log) => ({
    ...log,
    actor: log.User ?? { displayName: "Deleted User" },
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
    emoji: memberEmojiMap.get(m.userId)!,
    color: memberColorMap.get(m.userId)!,
  }));

  const initialExpenses: ExpenseRow[] = (expenses ?? []).map((expense) => ({
    id: expense.id,
    description: expense.description,
    amountCents: expense.amountCents,
    date: expense.date.split("T")[0]!,
    paidById: expense.paidById,
    paidByDisplayName: expense.User?.displayName ?? "Deleted User",
    participantIds: (expense.ExpenseSplit ?? []).map((s) => s.userId),
    canEdit: expense.isPayment ? false : isMember,
    canDelete: expense.isPayment ? expense.createdById === user.id : isMember,
    isPayment: expense.isPayment,
    createdById: expense.createdById ?? undefined,
  }));

  // Compute how much the current user owes on net (positive = owes money)
  const allExpenses = expenses ?? [];
  let paid = 0;
  let owed = 0;
  for (const expense of allExpenses) {
    if (expense.paidById === user.id) paid += expense.amountCents;
    for (const split of expense.ExpenseSplit ?? []) {
      if (split.userId === user.id) owed += split.amountCents;
    }
  }
  const userOwedCents = owed - paid; // positive = user owes money

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header + Members */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-700 mb-3 transition-colors py-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to groups
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{group.name}</h1>

        {/* Member chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {groupMembers.map((m) => (
            <MemberPill
              key={m.id}
              name={formatDisplayName(m.User!.displayName)}
              emoji={memberEmojiMap.get(m.userId)}
              color={memberColorMap.get(m.userId)}
              suffix={m.userId === user.id ? "· you" : undefined}
              title={m.User?.email ?? undefined}
            />
          ))}
          <AddMemberForm groupId={group.id} existingMemberIds={groupMembers.map((m) => m.userId)} />
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
        members={members}
        allUserNames={allUserNames}
      />

      <div className="pt-4">
        <LeaveGroupButton groupId={group.id} userOwedCents={userOwedCents} />
      </div>
    </div>
  );
}
