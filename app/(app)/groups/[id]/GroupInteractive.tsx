"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useActivityLogs } from "./useActivityLogs";
import { ActivityFeed, type ActivityLog } from "./ActivityFeed";
import { ExpensesList } from "./ExpensesList";
import type { ExpenseRow, Member } from "./ExpensesList";
import { simplifyDebts } from "@/lib/balances/simplify";
import { buildRawDebts } from "@/lib/balances/buildRawDebts";
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
    const debts = simplified.map((debt) => ({
      fromId: debt.from,
      fromName: formatDisplayName(nameMap.get(debt.from) ?? "Unknown"),
      toId: debt.to,
      toName: formatDisplayName(nameMap.get(debt.to) ?? "Unknown"),
      amountCents: debt.amount,
    }));
    // Current user's rows always appear first.
    return [...debts].sort((a, b) => {
      const aInvolves = a.fromId === currentUserId || a.toId === currentUserId;
      const bInvolves = b.fromId === currentUserId || b.toId === currentUserId;
      if (aInvolves && !bInvolves) return -1;
      if (!aInvolves && bInvolves) return 1;
      return 0;
    });
  }, [balancesExpenses, allUserNames, members, currentUserId]);

  const userOwesDebts = useMemo(
    () =>
      resolvedDebts
        .filter((d) => d.fromId === currentUserId)
        .map((d) => ({ toId: d.toId, toName: d.toName, amountCents: d.amountCents })),
    [resolvedDebts, currentUserId]
  );

  const userIsSettledUp =
    resolvedDebts.length > 0 &&
    !resolvedDebts.some((d) => d.fromId === currentUserId || d.toId === currentUserId);

  return (
    <>
      {/* Balances — compact text beneath member pills */}
      <div className="text-sm -mt-3 sm:-mt-5">
        {resolvedDebts.length === 0 ? (
          <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Everyone&apos;s settled up!
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-3 gap-y-0.5 text-gray-400 dark:text-gray-500">
            {userIsSettledUp && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                You&apos;re all settled up!
              </span>
            )}
            {resolvedDebts.map((debt, i) => {
              const isCurrentUserOwing = debt.fromId === currentUserId;
              const isCurrentUserReceiving = debt.toId === currentUserId;
              const involvesUser = isCurrentUserOwing || isCurrentUserReceiving;
              const verb = isCurrentUserOwing ? "owe" : "owes";
              const fromName = isCurrentUserOwing ? "You" : debt.fromName;
              const toName = isCurrentUserReceiving ? "you" : debt.toName;

              return (
                <span key={i} className="whitespace-nowrap">
                  <span className={involvesUser ? "text-gray-600 dark:text-gray-300" : ""}>
                    {fromName}
                  </span>
                  {" "}{verb}{" "}
                  <span className={involvesUser ? "text-gray-600 dark:text-gray-300" : ""}>
                    {toName}
                  </span>
                  {" "}
                  <span
                    className={`font-semibold tabular-nums ${
                      isCurrentUserOwing
                        ? "text-red-600 dark:text-red-400"
                        : isCurrentUserReceiving
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {formatCents(debt.amountCents)}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <ExpensesList
        groupId={groupId}
        groupCreatedById={groupCreatedById}
        currentUserId={currentUserId}
        currentUserDisplayName={currentUserDisplayName}
        initialExpenses={initialExpenses}
        members={members}
        allUserNames={allUserNames}
        userOwesDebts={userOwesDebts}
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
