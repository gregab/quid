import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm } from "./AddMemberForm";
import { LeaveGroupButton } from "./LeaveGroupButton";
import { GroupInteractive } from "./GroupInteractive";
import type { ExpenseRow, Member } from "./ExpensesList";

// Unique emoji per member slot (by join order → guaranteed no duplicates within a group)
// None of these overlap with GROUP_EMOJIS in dashboard/page.tsx
const MEMBER_EMOJIS = [
  "🦊", "🐼", "🧙", "🦄", "🐬", "🦁", "🐙", "🐢", "🦝", "🐻",
  "🐺", "🐲", "🦈", "🐸", "🦇", "🐿️", "🐨", "🐯", "🦦",
  "🦥", "🦔", "🐵", "🦋", "🐱",
];

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

  const isMember = groupMembers.some((m) => m.userId === user.id);
  if (!isMember) redirect("/dashboard");

  // Fetch expenses with paidBy user and splits
  const { data: expenses } = await supabase
    .from("Expense")
    .select("*, User!paidById(*), ExpenseSplit(*)")
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
    actor: log.User!,
  }));

  const currentMember = groupMembers.find((m) => m.userId === user.id);
  const currentUserDisplayName = currentMember?.User?.displayName ?? user.email ?? "You";

  const members: Member[] = groupMembers.map((m) => ({
    userId: m.userId,
    displayName: m.User!.displayName,
  }));

  const initialExpenses: ExpenseRow[] = (expenses ?? []).map((expense) => ({
    id: expense.id,
    description: expense.description,
    amountCents: expense.amountCents,
    date: expense.date.split("T")[0]!,
    paidById: expense.paidById,
    paidByDisplayName: expense.User!.displayName,
    participantIds: (expense.ExpenseSplit ?? []).map((s) => s.userId),
    canEdit: isMember,
    canDelete: isMember,
  }));

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
          {groupMembers.map((m, i) => (
            <div
              key={m.id}
              title={m.User?.email ?? undefined}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                m.userId === user.id
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              <span className="text-sm leading-none">{MEMBER_EMOJIS[i % MEMBER_EMOJIS.length]}</span>
              <span>{m.User!.displayName}</span>
              {m.userId === user.id && <span className="opacity-50">· you</span>}
            </div>
          ))}
          <AddMemberForm
            groupId={group.id}
            buttonClassName="!rounded-full !py-1 !px-2.5 !text-xs border-dashed"
          />
          <LeaveGroupButton groupId={group.id} />
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
      />
    </div>
  );
}
