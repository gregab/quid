import { Card } from "@/components/ui/Card";

export type ActivityLog = {
  id: string;
  action: string;
  payload: unknown;
  createdAt: Date;
  actor: { displayName: string };
  isPending?: boolean;
};

type Payload = {
  description?: string;
  amountCents?: number;
  previousAmountCents?: number;
  paidByDisplayName?: string;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function actionLabel(action: string): string {
  switch (action) {
    case "expense_added": return "added";
    case "expense_edited": return "edited";
    case "expense_deleted": return "deleted";
    default: return action;
  }
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
            const verb = actionLabel(log.action);
            const hasAmount = typeof payload.amountCents === "number";
            const amountChanged =
              log.action === "expense_edited" &&
              typeof payload.previousAmountCents === "number" &&
              payload.previousAmountCents !== payload.amountCents;

            return (
              <div key={log.id} className={`flex items-start justify-between gap-4 px-4 py-3${log.isPending ? " opacity-60" : ""}`}>
                <p className="text-sm text-gray-700 leading-snug dark:text-gray-300">
                  <span className="font-semibold">{log.actor.displayName}</span>
                  {" "}{verb}{" "}
                  {payload.description && (
                    <span className="font-medium">{payload.description}</span>
                  )}
                  {hasAmount && (
                    <span className="text-gray-500">
                      {" "}({amountChanged
                        ? `${formatCents(payload.previousAmountCents!)} → ${formatCents(payload.amountCents!)}`
                        : formatCents(payload.amountCents!)})
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
