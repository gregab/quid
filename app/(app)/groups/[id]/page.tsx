import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import { simplifyDebts } from "@/lib/balances/simplify";
import { Card } from "@/components/ui/Card";
import { AddMemberForm } from "./AddMemberForm";
import { AddExpenseForm } from "./AddExpenseForm";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 mb-2 inline-block">
          ← Back to groups
        </Link>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
      </div>

      {/* Balances */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Balances</h2>
        {resolvedDebts.length === 0 ? (
          <p className="text-gray-500 text-sm">Everyone&apos;s settled up!</p>
        ) : (
          <Card className="p-4">
            <ul className="space-y-2">
              {resolvedDebts.map((debt, i) => {
                const fromLabel = debt.fromId === user.id ? "You" : debt.fromName;
                const verb = debt.fromId === user.id ? "owe" : "owes";
                const toLabel = debt.toId === user.id ? "you" : debt.toName;
                return (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{fromLabel}</span>
                    {" "}{verb}{" "}
                    <span className="font-medium">{toLabel}</span>
                    {" "}
                    <span className="font-medium text-black">{formatCents(debt.amountCents)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {/* Expenses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Expenses</h2>
          <AddExpenseForm groupId={group.id} />
        </div>
        {group.expenses.length === 0 ? (
          <p className="text-gray-500 text-sm">No expenses yet. Add one to get started.</p>
        ) : (
          <ul className="space-y-2">
            {group.expenses.map((expense) => (
              <li key={expense.id}>
                <Card className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{expense.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Paid by {expense.paidBy.displayName} · {formatDate(expense.date)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {formatCents(expense.amountCents)}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Members</h2>
          <AddMemberForm groupId={group.id} />
        </div>
        <ul className="space-y-2">
          {group.members.map((m) => (
            <li key={m.id}>
              <Card className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">
                  {m.user.displayName[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {m.user.displayName}
                    {m.userId === user.id && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{m.user.email}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
