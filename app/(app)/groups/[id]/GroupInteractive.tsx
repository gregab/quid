"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useActivityLogs } from "./useActivityLogs";
import { ActivityFeed, type ActivityLog } from "./ActivityFeed";
import { ExpensesList } from "./ExpensesList";
import type { ExpenseRow, Member } from "./ExpensesList";
import { simplifyDebts } from "@/lib/balances/simplify";
import { splitAmount } from "@/lib/balances/splitAmount";
import { Card } from "@/components/ui/Card";
import { formatDisplayName } from "@/lib/formatDisplayName";

interface GroupInteractiveProps {
  groupId: string;
  groupCreatedById: string;
  currentUserId: string;
  currentUserDisplayName: string;
  initialExpenses: ExpenseRow[];
  initialLogs: ActivityLog[];
  members: Member[];
  allUserNames: Record<string, string>;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function GroupInteractive({
  groupId,
  groupCreatedById,
  currentUserId,
  currentUserDisplayName,
  initialExpenses,
  initialLogs,
  members,
  allUserNames,
}: GroupInteractiveProps) {
  const { logs, addOptimisticLog } = useActivityLogs(initialLogs);
  const [balancesExpenses, setBalancesExpenses] = useState<ExpenseRow[]>(initialExpenses);

  // Sync balances when server data arrives (e.g. after add resolves and pending items clear).
  useEffect(() => {
    setBalancesExpenses((prev) => {
      if (prev.some((e) => e.isPending)) return prev;
      return initialExpenses;
    });
  }, [initialExpenses]);

  const handleExpensesChange = useCallback((expenses: ExpenseRow[]) => {
    setBalancesExpenses(expenses);
  }, []);

  const resolvedDebts = useMemo(() => {
    const rawDebts: Array<{ from: string; to: string; amount: number }> = [];

    for (const expense of balancesExpenses) {
      const participantIds =
        expense.participantIds.length > 0
          ? expense.participantIds
          : members.map((m) => m.userId);
      const n = participantIds.length;
      if (n === 0) continue;
      const splits = splitAmount(expense.amountCents, n);
      participantIds.forEach((uid, i) => {
        if (uid === expense.paidById) return;
        rawDebts.push({ from: uid, to: expense.paidById, amount: splits[i]! });
      });
    }

    const simplified = simplifyDebts(rawDebts);
    // Build name map from all known users (includes departed members), then
    // override with current members so optimistic updates always resolve.
    const nameMap = new Map<string, string>(Object.entries(allUserNames));
    for (const m of members) nameMap.set(m.userId, m.displayName);
    return simplified.map((debt) => ({
      fromId: debt.from,
      fromName: formatDisplayName(nameMap.get(debt.from) ?? "Unknown"),
      toId: debt.to,
      toName: formatDisplayName(nameMap.get(debt.to) ?? "Unknown"),
      amountCents: debt.amount,
    }));
  }, [balancesExpenses, members, allUserNames]);

  return (
    <>
      {/* Balances */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3 dark:text-white">Balances</h2>
        {resolvedDebts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Everyone&apos;s settled up!
          </div>
        ) : (
          <Card className="divide-y divide-gray-100 dark:divide-gray-700">
            {resolvedDebts.map((debt, i) => {
              const isCurrentUserOwing = debt.fromId === currentUserId;
              const isCurrentUserReceiving = debt.toId === currentUserId;
              const fromLabel = isCurrentUserOwing ? "You" : debt.fromName;
              const verb = isCurrentUserOwing ? "owe" : "owes";
              const toLabel = isCurrentUserReceiving ? "you" : debt.toName;

              return (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
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

      <ExpensesList
        groupId={groupId}
        groupCreatedById={groupCreatedById}
        currentUserId={currentUserId}
        currentUserDisplayName={currentUserDisplayName}
        initialExpenses={initialExpenses}
        members={members}
        allUserNames={allUserNames}
        onOptimisticActivity={addOptimisticLog}
        onExpensesChange={handleExpensesChange}
      />
      <ActivityFeed logs={logs} />
    </>
  );
}
