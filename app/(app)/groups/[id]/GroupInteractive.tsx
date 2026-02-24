"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useActivityLogs } from "./useActivityLogs";
import { ActivityFeed, type ActivityLog } from "./ActivityFeed";
import { ExpensesList } from "./ExpensesList";
import type { ExpenseRow, Member } from "./ExpensesList";
import { simplifyDebts } from "@/lib/balances/simplify";
import { buildRawDebts } from "@/lib/balances/buildRawDebts";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { formatCents } from "@/lib/format";
import { Card } from "@/components/ui/Card";

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

  // Net balance for summary line
  const netBalance = useMemo(() => {
    let total = 0;
    for (const debt of resolvedDebts) {
      if (debt.toId === currentUserId) total += debt.amountCents;
      if (debt.fromId === currentUserId) total -= debt.amountCents;
    }
    return total;
  }, [resolvedDebts, currentUserId]);

  // Settlement celebration (#8)
  const [celebration, setCelebration] = useState<string | null>(null);
  const handleCelebration = useCallback((name: string) => {
    setCelebration(name);
    setTimeout(() => setCelebration(null), 3000);
  }, []);

  // Refresh button state (#9)
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [router]);

  return (
    <>
      {/* Settlement celebration banner */}
      {celebration && (
        <div className="settle-celebrate rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300">
          Settled up with {celebration}! ✨
        </div>
      )}

      {/* Balance card */}
      <Card className="px-4 py-3 -mt-2 sm:-mt-4">
        {/* Net summary line */}
        <div className={`flex items-center gap-2 ${resolvedDebts.length > 0 ? "mb-1.5" : ""}`}>
          {resolvedDebts.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              All settled up
            </p>
          ) : netBalance > 0 ? (
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              You&apos;re owed {formatCents(netBalance)} total
            </p>
          ) : netBalance < 0 ? (
            <p className="text-sm font-semibold text-rose-500 dark:text-rose-400">
              You owe {formatCents(Math.abs(netBalance))} total
            </p>
          ) : userIsSettledUp ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              You&apos;re all settled up
            </p>
          ) : (
            <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">
              Balances
            </p>
          )}
        </div>
        {/* Individual debt lines */}
        {resolvedDebts.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-3 gap-y-0.5 text-sm text-stone-500 dark:text-stone-400">
            {resolvedDebts.map((debt, i) => {
              const isCurrentUserOwing = debt.fromId === currentUserId;
              const isCurrentUserReceiving = debt.toId === currentUserId;
              const involvesUser = isCurrentUserOwing || isCurrentUserReceiving;
              const verb = isCurrentUserOwing ? "owe" : "owes";
              const fromName = isCurrentUserOwing ? "You" : debt.fromName;
              const toName = isCurrentUserReceiving ? "you" : debt.toName;

              return (
                <span key={i} className="whitespace-nowrap">
                  <span className={involvesUser ? "text-stone-700 dark:text-stone-200" : ""}>
                    {fromName}
                  </span>
                  {" "}{verb}{" "}
                  <span className={involvesUser ? "text-stone-700 dark:text-stone-200" : ""}>
                    {toName}
                  </span>
                  {" "}
                  <span
                    className={`font-semibold tabular-nums ${
                      isCurrentUserOwing
                        ? "text-red-600 dark:text-red-400"
                        : isCurrentUserReceiving
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-stone-500 dark:text-stone-400"
                    }`}
                  >
                    {formatCents(debt.amountCents)}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </Card>

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
        onCelebration={handleCelebration}
        onRefresh={handleRefresh}
        refreshing={refreshing}
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
