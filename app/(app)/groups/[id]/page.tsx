import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import { simplifyDebts } from "@/lib/balances/simplify";
import { Card } from "@/components/ui/Card";
import { AddMemberForm } from "./AddMemberForm";
import { ExpensesList } from "./ExpensesList";
import type { ExpenseRow, Member } from "./ExpensesList";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const group = await prisma.group.findUnique({
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
  });

  if (!group) redirect("/dashboard");

  const isMember = group.members.some((m) => m.userId === user.id);
  if (!isMember) redirect("/dashboard");

  // Compute balances from expenses
  const userMap = new Map(group.members.map((m) => [m.userId, m.user]));

  const rawDebts = group.expenses.flatMap((expense) =>
    expense.splits
      .filter((split) => split.userId !== expense.paidById)
      .map((split) => ({
        from: split.userId,
        to: expense.paidById,
        amount: split.amountCents,
      }))
  );

  const simplifiedDebts = simplifyDebts(rawDebts);

  const resolvedDebts = simplifiedDebts.map((debt) => ({
    fromId: debt.from,
    fromName: userMap.get(debt.from)?.displayName ?? "Unknown",
    toId: debt.to,
    toName: userMap.get(debt.to)?.displayName ?? "Unknown",
    amountCents: debt.amount,
  }));

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
    canEdit: expense.paidById === user.id,
    canDelete: expense.paidById === user.id || group.createdById === user.id,
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
        <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
      </div>

      {/* Balances */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Balances</h2>
        {resolvedDebts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Everyone&apos;s settled up!
          </div>
        ) : (
          <Card className="divide-y divide-gray-100">
            {resolvedDebts.map((debt, i) => {
              const isCurrentUserOwing = debt.fromId === user.id;
              const isCurrentUserReceiving = debt.toId === user.id;
              const fromLabel = isCurrentUserOwing ? "You" : debt.fromName;
              const verb = isCurrentUserOwing ? "owe" : "owes";
              const toLabel = isCurrentUserReceiving ? "you" : debt.toName;

              return (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{fromLabel}</span>
                    {" "}{verb}{" "}
                    <span className="font-semibold">{toLabel}</span>
                  </p>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      isCurrentUserOwing
                        ? "text-red-600"
                        : isCurrentUserReceiving
                        ? "text-emerald-600"
                        : "text-gray-700"
                    }`}
                  >
                    {formatCents(debt.amountCents)}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* Expenses (client component with optimistic updates) */}
      <ExpensesList
        groupId={group.id}
        groupCreatedById={group.createdById}
        currentUserId={user.id}
        currentUserDisplayName={currentUserDisplayName}
        initialExpenses={initialExpenses}
        members={members}
      />

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Members</h2>
          <AddMemberForm groupId={group.id} />
        </div>
        <ul className="space-y-2">
          {group.members.map((m) => (
            <li key={m.id}>
              <Card className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                  {m.user.displayName[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
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
