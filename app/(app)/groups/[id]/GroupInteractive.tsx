"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useActivityLogs } from "./useActivityLogs";
import { ActivityFeed, type ActivityLog } from "./ActivityFeed";
import { ExpensesList } from "./ExpensesList";
import type { ExpenseRow, Member } from "./ExpensesList";
import { simplifyDebts } from "@/lib/balances/simplify";
import { buildRawDebts } from "@/lib/balances/buildRawDebts";
import { Card } from "@/components/ui/Card";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { formatCents } from "@/lib/format";

interface GroupInteractiveProps {
  groupId: string;
  groupCreatedById: string;
  currentUserId: string;
  currentUserDisplayName: string;
  initialExpenses: ExpenseRow[];
  initialLogs: ActivityLog[];
  hasMoreLogs: boolean;
  members: Member[];
  allUserNames: Record<string, string>;
}


export function GroupInteractive({
  groupId,
  groupCreatedById,
  currentUserId,
  currentUserDisplayName,
  initialExpenses,
  initialLogs,
  hasMoreLogs,
  members,
  allUserNames,
}: GroupInteractiveProps) {
  const { logs, addOptimisticLog, hasMore, isLoadingMore, loadMore } =
    useActivityLogs(initialLogs, groupId, hasMoreLogs);
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
    const simplified = simplifyDebts(buildRawDebts(balancesExpenses));
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
  }, [balancesExpenses, allUserNames, members]);

  return (
    <>
      {/* Balances */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3 dark:text-white">Balances</h2>
        {resolvedDebts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
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
              const verb = isCurrentUserOwing ? "owe" : "owes";

              const fromName = isCurrentUserOwing ? "You" : debt.fromName;
              const toName = isCurrentUserReceiving ? "You" : debt.toName;

              return (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{fromName}</span>
                    <span>{verb}</span>
                    <span className="font-medium">{toName}</span>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums shrink-0 ${
                      isCurrentUserOwing
                        ? "text-red-600 dark:text-red-400"
                        : isCurrentUserReceiving
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-700 dark:text-gray-300"
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
      <ActivityFeed
        logs={logs}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
      />
    </>
  );
}
