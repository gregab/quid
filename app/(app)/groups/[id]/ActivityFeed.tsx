"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { formatCents } from "@/lib/format";

import type { ActivityLog, SplitEntry } from "@aviary/shared";

export type { ActivityLog };

type Changes = {
  amount?: { from: number; to: number };
  date?: { from: string; to: string };
  description?: { from: string; to: string };
  paidBy?: { from: string; to: string };
  participants?: { added: string[]; removed: string[] };
  splitType?: { from: string; to: string };
};

type Payload = {
  description?: string;
  amountCents?: number;
  previousAmountCents?: number;
  paidByDisplayName?: string;
  changes?: Changes;
  fromDisplayName?: string;
  toDisplayName?: string;
  settledUp?: boolean;
  date?: string;
  participantDisplayNames?: string[];
  splitType?: string;
  splits?: SplitEntry[];
  splitsBefore?: SplitEntry[];
};


function formatRelativeTime(date: Date | string): string {
  // Supabase returns TIMESTAMP WITHOUT TIME ZONE strings with no timezone suffix.
  // Without a 'Z', JS parses them as local time → timestamps appear to be hours
  // in the future for users west of UTC, giving negative diffMs → "just now" for
  // everything. Append 'Z' when there's no timezone indicator to force UTC parsing.
  let d: Date;
  if (typeof date === "string") {
    const normalized = /[Z+]/.test(date.slice(-6)) ? date : date + "Z";
    d = new Date(normalized);
  } else {
    d = date;
  }
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

const ACTION_TITLES: Record<string, string> = {
  expense_added: "Expense added",
  expense_edited: "Expense edited",
  expense_deleted: "Expense deleted",
  payment_recorded: "Payment recorded",
  payment_deleted: "Payment deleted",
};

function ActivityLogModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const payload = log.payload as Payload;
  const title = ACTION_TITLES[log.action] ?? log.action;

  const isExpenseAction =
    log.action === "expense_added" || log.action === "expense_deleted";
  const isPaymentAction =
    log.action === "payment_recorded" || log.action === "payment_deleted";

  const hasChanges =
    log.action === "expense_edited" &&
    payload.changes &&
    Object.keys(payload.changes).length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl dark:bg-stone-800">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-0.5">
              Activity
            </p>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1 -mt-1 -mr-1 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* expense_added / expense_deleted */}
        {isExpenseAction && (
          <div className="space-y-3 mb-5">
            {payload.description && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Expense
                </p>
                <p className="text-base font-semibold text-stone-900 dark:text-white">
                  {payload.description}
                </p>
              </div>
            )}
            {typeof payload.amountCents === "number" && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Amount
                </p>
                <p className="text-base font-semibold text-stone-900 dark:text-white">
                  {formatCents(payload.amountCents)}
                </p>
              </div>
            )}
            {payload.date && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Date
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  {formatExpenseDate(payload.date)}
                </p>
              </div>
            )}
            {payload.paidByDisplayName && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Paid by
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  {formatDisplayName(payload.paidByDisplayName)}
                </p>
              </div>
            )}
            {payload.splits && payload.splits.length > 0 ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Split{payload.splitType ? ` (${payload.splitType === "custom" ? "Custom" : "Equal"})` : ""}
                </p>
                <div className="space-y-0.5">
                  {payload.splits.map((s, i) => (
                    <p key={i} className="text-sm text-stone-700 dark:text-stone-300">
                      {formatDisplayName(s.displayName)} · {formatCents(s.amountCents)}
                    </p>
                  ))}
                </div>
              </div>
            ) : payload.participantDisplayNames && payload.participantDisplayNames.length > 0 ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Split between
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  {formatNameList(payload.participantDisplayNames.map(formatDisplayName))}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* expense_edited */}
        {log.action === "expense_edited" && (
          <div className="space-y-3 mb-5">
            {/* Current expense name (always shown for context) */}
            {payload.description && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Expense
                </p>
                <p className="text-base font-semibold text-stone-900 dark:text-white">
                  {payload.description}
                </p>
              </div>
            )}

            {/* Date as context — only shown when the date didn't change (otherwise it's in Changes) */}
            {payload.date && !payload.changes?.date && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Date
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  {formatExpenseDate(payload.date)}
                </p>
              </div>
            )}

            {/* If there's a rich changes object, show the diff */}
            {hasChanges && payload.changes && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1.5">
                  Changes
                </p>
                <div className="space-y-1.5">
                  {payload.changes.description && (
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">Renamed:</span>{" "}
                      {payload.changes.description.from} → {payload.changes.description.to}
                    </p>
                  )}
                  {payload.changes.amount && (
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">Amount:</span>{" "}
                      {formatCents(payload.changes.amount.from)} → {formatCents(payload.changes.amount.to)}
                    </p>
                  )}
                  {payload.changes.date && (
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">Date:</span>{" "}
                      {formatExpenseDate(payload.changes.date.from)} → {formatExpenseDate(payload.changes.date.to)}
                    </p>
                  )}
                  {payload.changes.paidBy && (
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">Payer:</span>{" "}
                      {formatDisplayName(payload.changes.paidBy.from)} → {formatDisplayName(payload.changes.paidBy.to)}
                    </p>
                  )}
                  {(payload.changes.participants?.added ?? []).length > 0 && (
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">Added:</span>{" "}
                      {formatNameList(
                        (payload.changes.participants!.added ?? []).map(formatDisplayName)
                      )}
                    </p>
                  )}
                  {(payload.changes.participants?.removed ?? []).length > 0 && (
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">Removed:</span>{" "}
                      {formatNameList(
                        (payload.changes.participants!.removed ?? []).map(formatDisplayName)
                      )}
                    </p>
                  )}
                  {payload.changes.splitType && (
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">Split type:</span>{" "}
                      {payload.changes.splitType.from === "custom" ? "Custom" : "Equal"}{" → "}
                      {payload.changes.splitType.to === "custom" ? "Custom" : "Equal"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Fallback: no rich changes — show current state */}
            {!hasChanges && (
              <>
                {typeof payload.amountCents === "number" && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                      Amount
                    </p>
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      {typeof payload.previousAmountCents === "number" &&
                      payload.previousAmountCents !== payload.amountCents
                        ? `${formatCents(payload.previousAmountCents)} → ${formatCents(payload.amountCents)}`
                        : formatCents(payload.amountCents)}
                    </p>
                  </div>
                )}
                {payload.paidByDisplayName && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                      Paid by
                    </p>
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                      {formatDisplayName(payload.paidByDisplayName)}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Splits before/after snapshot */}
            {payload.splitsBefore && payload.splits ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1.5">
                  Split{payload.splitType ? ` (${payload.splitType === "custom" ? "Custom" : "Equal"})` : ""}
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-0.5">Before</p>
                    <div className="space-y-0.5">
                      {payload.splitsBefore.map((s, i) => (
                        <p key={i} className="text-sm text-stone-700 dark:text-stone-300">
                          {formatDisplayName(s.displayName)} · {formatCents(s.amountCents)}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-0.5">After</p>
                    <div className="space-y-0.5">
                      {payload.splits.map((s, i) => (
                        <p key={i} className="text-sm text-stone-700 dark:text-stone-300">
                          {formatDisplayName(s.displayName)} · {formatCents(s.amountCents)}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : payload.splits ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Split{payload.splitType ? ` (${payload.splitType === "custom" ? "Custom" : "Equal"})` : ""}
                </p>
                <div className="space-y-0.5">
                  {payload.splits.map((s, i) => (
                    <p key={i} className="text-sm text-stone-700 dark:text-stone-300">
                      {formatDisplayName(s.displayName)} · {formatCents(s.amountCents)}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* payment_recorded / payment_deleted */}
        {isPaymentAction && (
          <div className="space-y-3 mb-5">
            {typeof payload.amountCents === "number" && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Amount
                </p>
                <p className="text-base font-semibold text-stone-900 dark:text-white">
                  {formatCents(payload.amountCents)}
                </p>
              </div>
            )}
            {payload.date && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  Date
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  {formatExpenseDate(payload.date)}
                </p>
              </div>
            )}
            {payload.fromDisplayName && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  From
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  {formatDisplayName(payload.fromDisplayName)}
                </p>
              </div>
            )}
            {payload.toDisplayName && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                  To
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  {formatDisplayName(payload.toDisplayName)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between gap-3">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            By {formatDisplayName(log.actor.displayName)} · {formatRelativeTime(log.createdAt)}
          </p>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function isClickable(log: ActivityLog): boolean {
  return !log.isPending && log.action !== "member_left";
}

export function ActivityFeed({
  logs,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  logs: ActivityLog[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  return (
    <>
      {selectedLog && (
        <ActivityLogModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
      <section>
        <h2 className="text-lg font-bold text-stone-900 mb-3 dark:text-white">Activity</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-stone-400">No activity yet.</p>
        ) : (
          <>
          <Card className="divide-y divide-stone-100 dark:divide-stone-700">
            {logs.map((log) => {
              const payload = log.payload as Payload;
              const clickable = isClickable(log);
              const rowClass = `expense-item-enter flex items-start justify-between gap-4 px-4 py-3${log.isPending ? " opacity-60" : ""}${clickable ? " cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors" : ""}`;
              const handleClick = clickable ? () => setSelectedLog(log) : undefined;

              if (log.action === "expense_edited") {
                return (
                  <div key={log.id} className={rowClass} onClick={handleClick}>
                    <p className="text-sm text-stone-700 leading-snug dark:text-stone-300">
                      <span className="font-semibold">{formatDisplayName(log.actor.displayName)}</span>
                      {" "}edited
                      {payload.description && (
                        <>{" "}<span className="font-medium">{payload.description}</span></>
                      )}
                    </p>
                    <span className="text-xs text-stone-400 shrink-0 mt-0.5">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                );
              }

              if (log.action === "payment_recorded" || log.action === "payment_deleted") {
                const isSettledUp = log.action === "payment_recorded" && payload.settledUp === true;

                if (isSettledUp && payload.fromDisplayName && payload.toDisplayName) {
                  return (
                    <div key={log.id} className={rowClass} onClick={handleClick}>
                      <p className="text-sm leading-snug">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatDisplayName(payload.fromDisplayName)}</span>
                        <span className="text-stone-700 dark:text-stone-300">{" "}settled up with{" "}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatDisplayName(payload.toDisplayName)}</span>
                        <span className="text-stone-700 dark:text-stone-300">!</span>
                        {typeof payload.amountCents === "number" && (
                          <span className="text-stone-500 dark:text-stone-400"> ({formatCents(payload.amountCents)})</span>
                        )}
                        <span className="ml-1">✨</span>
                      </p>
                      <span className="text-xs text-stone-400 shrink-0 mt-0.5">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                  );
                }

                const verb = log.action === "payment_recorded" ? "recorded a payment" : "deleted a payment";
                return (
                  <div key={log.id} className={rowClass} onClick={handleClick}>
                    <p className="text-sm text-stone-700 leading-snug dark:text-stone-300">
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
                        <span className="text-stone-500 dark:text-stone-400"> ({formatCents(payload.amountCents)})</span>
                      )}
                    </p>
                    <span className="text-xs text-stone-400 shrink-0 mt-0.5">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                );
              }

              if (log.action === "member_left") {
                return (
                  <div key={log.id} className={rowClass}>
                    <p className="text-sm text-stone-700 leading-snug dark:text-stone-300">
                      <span className="font-semibold">{formatDisplayName(log.actor.displayName)}</span>
                      {" "}left the group
                    </p>
                    <span className="text-xs text-stone-400 shrink-0 mt-0.5">
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
                <div key={log.id} className={rowClass} onClick={handleClick}>
                  <p className="text-sm text-stone-700 leading-snug dark:text-stone-300">
                    <span className="font-semibold">{formatDisplayName(log.actor.displayName)}</span>
                    {" "}{verb}{" "}
                    {payload.description && (
                      <span className="font-medium">{payload.description}</span>
                    )}
                    {hasAmount && (
                      <span className="text-stone-500 dark:text-stone-400">
                        {" "}({formatCents(payload.amountCents!)})
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-stone-400 shrink-0 mt-0.5">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              );
            })}
          </Card>
          {(hasMore || isLoadingMore) && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
              >
                Show more
              </button>
            </div>
          )}
          </>
        )}
      </section>
    </>
  );
}
