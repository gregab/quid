import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import { AddMemberForm } from "./AddMemberForm";
import { GroupInteractive } from "./GroupInteractive";
import type { ExpenseRow, Member } from "./ExpensesList";

// Unique emoji per member slot (by join order → guaranteed no duplicates within a group)
const MEMBER_EMOJIS = [
  "🦊", "🐼", "🌺", "🧙", "🦋", "🌵", "🦄", "🐬", "🍄", "🦁",
  "🐙", "🦜", "🐢", "🌙", "⚡", "🎨", "🐧", "🦩", "🌻", "🦝",
  "🍀", "🐻", "🌸", "🦚", "🎯",
];

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [group, activityLogs] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
          orderBy: { joinedAt: "asc" },
        },
        expenses: {
          include: { paidBy: true, splits: true },
          orderBy: { date: "desc" },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: { groupId: id },
      include: { actor: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!group) redirect("/dashboard");

  const isMember = group.members.some((m) => m.userId === user.id);
  if (!isMember) redirect("/dashboard");

  const currentMember = group.members.find((m) => m.userId === user.id);
  const currentUserDisplayName = currentMember?.user.displayName ?? user.email ?? "You";

  const members: Member[] = group.members.map((m) => ({
    userId: m.userId,
    displayName: m.user.displayName,
  }));

  const initialExpenses: ExpenseRow[] = group.expenses.map((expense) => ({
    id: expense.id,
    description: expense.description,
    amountCents: expense.amountCents,
    date: expense.date.toISOString().split("T")[0]!,
    paidById: expense.paidById,
    paidByDisplayName: expense.paidBy.displayName,
    participantIds: expense.splits.map((s) => s.userId),
    canEdit: isMember,
    canDelete: isMember,
  }));

  return (
    <div className="space-y-8">
      {/* Header + Members */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-indigo-600 mb-3 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to groups
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{group.name}</h1>

        {/* Member chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {group.members.map((m, i) => (
            <div
              key={m.id}
              title={m.user.email ?? undefined}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                m.userId === user.id
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              <span className="text-sm leading-none">{MEMBER_EMOJIS[i % MEMBER_EMOJIS.length]}</span>
              <span>{m.user.displayName}</span>
              {m.userId === user.id && <span className="opacity-50">· you</span>}
            </div>
          ))}
          <AddMemberForm
            groupId={group.id}
            buttonClassName="!rounded-full !py-1 !px-2.5 !text-xs border-dashed"
          />
        </div>
      </div>

      {/* Expenses, Activity, and Balances (client component with optimistic updates) */}
      <GroupInteractive
        groupId={group.id}
        groupCreatedById={group.createdById}
        currentUserId={user.id}
        currentUserDisplayName={currentUserDisplayName}
        initialExpenses={initialExpenses}
        initialLogs={activityLogs}
        members={members}
      />
    </div>
  );
}
