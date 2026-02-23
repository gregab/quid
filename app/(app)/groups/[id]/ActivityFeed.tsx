import { Card } from "@/components/ui/Card";
import { formatDisplayName } from "@/lib/formatDisplayName";

export type ActivityLog = {
  id: string;
  action: string;
  payload: unknown;
  createdAt: Date | string;
  actor: { displayName: string };
  isPending?: boolean;
};

type Changes = {
  amount?: { from: number; to: number };
  date?: { from: string; to: string };
  description?: { from: string; to: string };
  paidBy?: { from: string; to: string };
  participants?: { added: string[]; removed: string[] };
};

type Payload = {
  description?: string;
  amountCents?: number;
  previousAmountCents?: number;
  paidByDisplayName?: string;
  changes?: Changes;
  fromDisplayName?: string;
  toDisplayName?: string;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNameList(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function formatExpenseDate(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  return new Date(
    Date.UTC(parseInt(yearStr!, 10), parseInt(monthStr!, 10) - 1, parseInt(dayStr!, 10))
  ).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

type EditInfo = {
  verbAndPrep: string;
  showExpenseName: boolean;
  detail: string | null;
};

function buildEditInfo(payload: Payload): EditInfo {
  const { changes } = payload;

  // Backward compat: old logs have no changes object
  if (!changes) {
    const amountChanged =
      typeof payload.previousAmountCents === "number" &&
      payload.previousAmountCents !== payload.amountCents;
    const detail =
      typeof payload.amountCents === "number"
        ? amountChanged
          ? `${formatCents(payload.previousAmountCents!)} → ${formatCents(payload.amountCents!)}`
          : formatCents(payload.amountCents!)
        : null;
    return { verbAndPrep: "edited", showExpenseName: true, detail };
  }

  const verbs: string[] = [];
  const details: string[] = [];

  if (changes.participants) {
    const added = (changes.participants.added ?? []).map(formatDisplayName);
    const removed = (changes.participants.removed ?? []).map(formatDisplayName);
    if (added.length > 0 && removed.length > 0) {
      verbs.push(`added ${formatNameList(added)}, removed ${formatNameList(removed)}`);
    } else if (added.length > 0) {
      verbs.push(`added ${formatNameList(added)}`);
    } else if (removed.length > 0) {
      verbs.push(`removed ${formatNameList(removed)}`);
    }
  }

  if (changes.amount) {
    verbs.push("changed the price");
    details.push(`${formatCents(changes.amount.from)} → ${formatCents(changes.amount.to)}`);
  }

  if (changes.date) {
    verbs.push("changed the date");
    details.push(`${formatExpenseDate(changes.date.from)} → ${formatExpenseDate(changes.date.to)}`);
  }

  if (changes.paidBy) {
    verbs.push("changed the payer");
    details.push(`${formatDisplayName(changes.paidBy.from)} → ${formatDisplayName(changes.paidBy.to)}`);
  }

  if (changes.description) {
    verbs.push("renamed");
    details.push(`${changes.description.from} → ${changes.description.to}`);
  }

  if (verbs.length === 0) {
    return { verbAndPrep: "edited", showExpenseName: true, detail: null };
  }

  // Rename-only: don't show a separate expense name since the rename detail shows old → new
  if (changes.description && verbs.length === 1) {
    return {
      verbAndPrep: "renamed",
      showExpenseName: false,
      detail: `${changes.description.from} → ${changes.description.to}`,
    };
  }

  // Determine preposition
  const ptc = changes.participants;
  const isOnlyParticipantAdd =
    ptc && (ptc.added?.length ?? 0) > 0 && (ptc.removed?.length ?? 0) === 0 && verbs.length === 1;
  const isOnlyParticipantRemove =
    ptc && (ptc.added?.length ?? 0) === 0 && (ptc.removed?.length ?? 0) > 0 && verbs.length === 1;

  const preposition = isOnlyParticipantAdd ? "to" : isOnlyParticipantRemove ? "from" : "on";

  return {
    verbAndPrep: `${verbs.join(" and ")} ${preposition}`,
    showExpenseName: true,
    detail: details.length > 0 ? details.join(", ") : null,
  };
}

export function ActivityFeed({ logs }: { logs: ActivityLog[] }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900 mb-3 dark:text-white">Activity</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">No activity yet.</p>
      ) : (
        <Card className="divide-y divide-gray-100 dark:divide-gray-700">
          {logs.map((log) => {
            const payload = log.payload as Payload;

            if (log.action === "expense_edited") {
              const { verbAndPrep, showExpenseName, detail } = buildEditInfo(payload);
              return (
                <div key={log.id} className={`flex items-start justify-between gap-4 px-4 py-3${log.isPending ? " opacity-60" : ""}`}>
                  <p className="text-sm text-gray-700 leading-snug dark:text-gray-300">
                    <span className="font-semibold">{formatDisplayName(log.actor.displayName)}</span>
                    {" "}{verbAndPrep}
                    {showExpenseName && payload.description && (
                      <>{" "}<span className="font-medium">{payload.description}</span></>
                    )}
                    {detail && (
                      <span className="text-gray-500"> ({detail})</span>
                    )}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              );
            }

            if (log.action === "payment_recorded" || log.action === "payment_deleted") {
              const verb = log.action === "payment_recorded" ? "recorded a payment" : "deleted a payment";
              return (
                <div key={log.id} className={`flex items-start justify-between gap-4 px-4 py-3${log.isPending ? " opacity-60" : ""}`}>
                  <p className="text-sm text-gray-700 leading-snug dark:text-gray-300">
                    <span className="font-semibold">{formatDisplayName(log.actor.displayName)}</span>
                    {" "}{verb}
                    {payload.fromDisplayName && payload.toDisplayName && (
                      <>
                        {": "}
                        <span className="font-medium">{formatDisplayName(payload.fromDisplayName)}</span>
                        {" → "}
                        <span className="font-medium">{formatDisplayName(payload.toDisplayName)}</span>
                      </>
                    )}
                    {typeof payload.amountCents === "number" && (
                      <span className="text-gray-500"> ({formatCents(payload.amountCents)})</span>
                    )}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              );
            }

            if (log.action === "member_left") {
              return (
                <div key={log.id} className={`flex items-start justify-between gap-4 px-4 py-3${log.isPending ? " opacity-60" : ""}`}>
                  <p className="text-sm text-gray-700 leading-snug dark:text-gray-300">
                    <span className="font-semibold">{formatDisplayName(log.actor.displayName)}</span>
                    {" "}left the group
                  </p>
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              );
            }

            const verb =
              log.action === "expense_added" ? "added" :
              log.action === "expense_deleted" ? "deleted" :
              log.action;
            const hasAmount = typeof payload.amountCents === "number";

            return (
              <div key={log.id} className={`flex items-start justify-between gap-4 px-4 py-3${log.isPending ? " opacity-60" : ""}`}>
                <p className="text-sm text-gray-700 leading-snug dark:text-gray-300">
                  <span className="font-semibold">{formatDisplayName(log.actor.displayName)}</span>
                  {" "}{verb}{" "}
                  {payload.description && (
                    <span className="font-medium">{payload.description}</span>
                  )}
                  {hasAmount && (
                    <span className="text-gray-500">
                      {" "}({formatCents(payload.amountCents!)})
                    </span>
                  )}
                </p>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
