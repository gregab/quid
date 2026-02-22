import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import { Card } from "@/components/ui/Card";
import { AddMemberForm } from "./AddMemberForm";
import { GroupInteractive } from "./GroupInteractive";
import type { ExpenseRow, Member } from "./ExpensesList";

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
      {/* Header */}
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

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Members</h2>
          <AddMemberForm groupId={group.id} />
        </div>
        <ul className="space-y-2">
          {group.members.map((m) => (
            <li key={m.id}>
              <Card className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0 dark:bg-indigo-900 dark:text-indigo-400">
                  {m.user.displayName[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {m.user.displayName}
                    {m.userId === user.id && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{m.user.email}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
