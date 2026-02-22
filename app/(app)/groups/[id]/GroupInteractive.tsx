"use client";

import { useActivityLogs } from "./useActivityLogs";
import { ActivityFeed, type ActivityLog } from "./ActivityFeed";
import { ExpensesList } from "./ExpensesList";
import type { ExpenseRow, Member } from "./ExpensesList";

interface GroupInteractiveProps {
  groupId: string;
  groupCreatedById: string;
  currentUserId: string;
  currentUserDisplayName: string;
  initialExpenses: ExpenseRow[];
  initialLogs: ActivityLog[];
  members: Member[];
}

export function GroupInteractive({
  groupId,
  groupCreatedById,
  currentUserId,
  currentUserDisplayName,
  initialExpenses,
  initialLogs,
  members,
}: GroupInteractiveProps) {
  const { logs, addOptimisticLog } = useActivityLogs(initialLogs);

  return (
    <>
      <ExpensesList
        groupId={groupId}
        groupCreatedById={groupCreatedById}
        currentUserId={currentUserId}
        currentUserDisplayName={currentUserDisplayName}
        initialExpenses={initialExpenses}
        members={members}
        onOptimisticActivity={addOptimisticLog}
      />
      <ActivityFeed logs={logs} />
    </>
  );
}
