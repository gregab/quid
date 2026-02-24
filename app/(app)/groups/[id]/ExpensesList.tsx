"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AddExpenseForm } from "./AddExpenseForm";
import { RecordPaymentForm, type UserOwesDebt } from "./RecordPaymentForm";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import { useInviteShare } from "./useInviteShare";
import { ExportButton } from "./ExportButton";
import type { ActivityLog } from "./ActivityFeed";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { formatCents } from "@/lib/format";
import type { MemberColor } from "./MemberPill";

export interface Member {
  userId: string;
  displayName: string;
  emoji?: string;
  color?: MemberColor;
  avatarUrl?: string | null;
}

export interface ExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  paidById: string;
  paidByDisplayName: string;
  participantIds: string[];
  splits: Array<{ userId: string; amountCents: number }>;
  splitType: "equal" | "custom";
  canEdit: boolean;
  canDelete: boolean;
  isPending?: boolean;
  isPayment?: boolean;
  settledUp?: boolean;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string | null;
  recurringExpense?: { id: string; frequency: "weekly" | "monthly" | "yearly" } | null;
}

interface ExpensesListProps {
  groupId: string;
  groupCreatedById: string;
  currentUserId: string;
  currentUserDisplayName: string;
  initialExpenses: ExpenseRow[];
  members: Member[];
  allUserNames: Record<string, string>;
  userOwesDebts: UserOwesDebt[];
  inviteToken: string;
  onOptimisticActivity: (log: ActivityLog) => void;
  onExpensesChange?: (expenses: ExpenseRow[]) => void;
  onCelebration?: (name: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}


function formatDateBlock(dateStr: string): { month: string; day: string } {
  // Parse YYYY-MM-DD as local date to avoid UTC-shift issues
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(day!),
  };
}

function getMemberPillProps(
  userId: string,
  members: Member[],
  allUserNames: Record<string, string>
): { name: string; emoji?: string; color?: MemberColor } {
  const member = members.find((m) => m.userId === userId);
  if (member) {
    return { name: formatDisplayName(member.displayName), emoji: member.emoji, color: member.color };
  }
  return { name: formatDisplayName(allUserNames[userId] ?? "Unknown") };
}

/**
 * Returns the current user's personal financial stake in this expense:
 * - "you lent $X" (green) when they paid and others owe them
 * - "you owe $X" (red) when someone else paid and they're a participant
 * - null when user isn't involved, or it's a payment (already settled semantics)
 */
function getPersonalContext(
  expense: ExpenseRow,
  currentUserId: string
): { label: string; amountCents: number; positive: boolean } | null {
  if (expense.isPayment) return null;

  const mySplit = expense.splits.find((s) => s.userId === currentUserId);
  const amIParticipant = mySplit !== undefined;
  const amIPayer = expense.paidById === currentUserId;

  if (amIPayer) {
    const myShare = mySplit?.amountCents ?? 0;
    const lentAmount = expense.amountCents - myShare;
    if (lentAmount <= 0) return null;
    return { label: "you lent", amountCents: lentAmount, positive: true };
  }

  if (amIParticipant) {
    const myShare = mySplit!.amountCents;
    if (myShare <= 0) return null;
    return { label: "you owe", amountCents: myShare, positive: false };
  }

  return null;
}

/**
 * Returns a human-readable payment direction line from the current user's perspective:
 * - "you paid [Name]" when the current user is the sender
 * - "[Name] paid you" when the current user is the receiver
 * - "[From] → [To]" otherwise
 */
function getPaymentDirection(
  expense: ExpenseRow,
  currentUserId: string,
  members: Member[],
  allUserNames: Record<string, string>
): string {
  const receiverId = expense.participantIds[0];
  const toName = receiverId ? getMemberPillProps(receiverId, members, allUserNames).name : "Unknown";
  const fromName = getMemberPillProps(expense.paidById, members, allUserNames).name;

  if (expense.paidById === currentUserId) return `you paid ${toName}`;
  if (receiverId === currentUserId) return `${fromName} paid you`;
  return `${fromName} → ${toName}`;
}

/**
 * Returns the "settled up with" title for a settled-up payment card.
 * Always uses display names (no "you" pronoun): "Alice settled up with Bob"
 */
export function getSettledUpTitle(
  expense: ExpenseRow,
  members: Member[],
  allUserNames: Record<string, string>
): string {
  const receiverId = expense.participantIds[0];
  const toName = receiverId ? getMemberPillProps(receiverId, members, allUserNames).name : "Unknown";
  const fromName = getMemberPillProps(expense.paidById, members, allUserNames).name;
  return `${fromName} settled up with ${toName}`;
}

export function ExpensesList({
  groupId,
  groupCreatedById,
  currentUserId,
  currentUserDisplayName,
  initialExpenses,
  members,
  allUserNames,
  userOwesDebts,
  inviteToken,
  onOptimisticActivity,
  onExpensesChange,
  onCelebration,
  onRefresh,
  refreshing,
}: ExpensesListProps) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialExpenses);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [openDetailExpenseId, setOpenDetailExpenseId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(30);
  const { canShare, copied, share } = useInviteShare(inviteToken);

  // FAB: track whether inline buttons are out of view
  const inlineButtonsRef = useRef<HTMLDivElement>(null);
  const mobileButtonsRef = useRef<HTMLDivElement>(null);
  const [fabVisible, setFabVisible] = useState(false);
  const [fabCompact, setFabCompact] = useState(false);

  useEffect(() => {
    const desktopTarget = inlineButtonsRef.current;
    const mobileTarget = mobileButtonsRef.current;
    if (!desktopTarget || !mobileTarget) return;

    // Track intersection state for both refs. FAB shows only when
    // the viewport-relevant buttons have scrolled out of view.
    // display:none elements report isIntersecting=false, so we need
    // both to be non-intersecting before showing the FAB.
    let desktopVisible = false;
    let mobileVisible = false;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === desktopTarget) {
            desktopVisible = entry.isIntersecting;
            // Compact when scrolled well past (desktop only)
            setFabCompact(entry.boundingClientRect.bottom < -100);
          } else if (entry.target === mobileTarget) {
            mobileVisible = entry.isIntersecting;
          }
        }
        // Show FAB only when neither set of buttons is visible
        setFabVisible(!desktopVisible && !mobileVisible);
      },
      { threshold: 0 }
    );
    observer.observe(desktopTarget);
    observer.observe(mobileTarget);
    return () => observer.disconnect();
  }, []);

  // When router.refresh() delivers fresh server data, sync local state.
  // useState(initialExpenses) only uses the prop as the initial value and ignores
  // subsequent changes, so we need this effect to reconcile. Always sync — no
  // real-time updates mean initialExpenses only changes after our own API calls.
  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  // Notify parent when expenses change so it can recompute balances.
  useEffect(() => {
    onExpensesChange?.(expenses);
  }, [expenses, onExpensesChange]);

  const handleOptimisticAdd = useCallback((expense: ExpenseRow) => {
    setExpenses((prev) => [expense, ...prev]);
  }, []);

  const handleAddSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleOptimisticDelete = useCallback((expenseId: string) => {
    setRemovingIds((prev) => new Set(prev).add(expenseId));
    // Remove from list after exit animation
    setTimeout(() => {
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }, 200);
  }, []);

  const handleDeleteFailed = useCallback((expense: ExpenseRow) => {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.delete(expense.id);
      return next;
    });
    setExpenses((prev) => {
      // Only re-add if it was actually removed
      if (prev.some((e) => e.id === expense.id)) return prev;
      return [...prev, expense].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      });
    });
    // Refresh to reconcile any pending activity logs
    router.refresh();
  }, [router]);

  const handleDeleteSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleOptimisticUpdate = useCallback((updated: ExpenseRow) => {
    setExpenses((prev) =>
      prev
        .map((e) => (e.id === updated.id ? updated : e))
        .sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
        })
    );
  }, []);

  const handleUpdateSettled = useCallback(() => {
    router.refresh();
  }, [router]);

  const needsMembers = members.length <= 1;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Expenses</h2>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:text-stone-300 dark:hover:bg-stone-800 transition-colors"
              aria-label="Refresh"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {expenses.length > 0 && <ExportButton groupId={groupId} />}
        </div>
        {/* Desktop: buttons in header */}
        <div ref={inlineButtonsRef} className="hidden sm:flex items-center gap-2">
          <RecordPaymentForm
            groupId={groupId}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            members={members}
            userOwesDebts={userOwesDebts}
            onOptimisticAdd={handleOptimisticAdd}
            onSettled={handleAddSettled}
            onOptimisticActivity={onOptimisticActivity}
            onCelebration={onCelebration}
          />
          <AddExpenseForm
            groupId={groupId}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            members={members}
            onOptimisticAdd={handleOptimisticAdd}
            onSettled={handleAddSettled}
            onOptimisticActivity={onOptimisticActivity}
          />
        </div>
      </div>

      {/* Mobile: buttons below heading, above list */}
      <div ref={mobileButtonsRef} className="flex sm:hidden gap-2 mb-3">
        <RecordPaymentForm
          groupId={groupId}
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          members={members}
          userOwesDebts={userOwesDebts}
          onOptimisticAdd={handleOptimisticAdd}
          onSettled={handleAddSettled}
          onOptimisticActivity={onOptimisticActivity}
          onCelebration={onCelebration}
        />
        <AddExpenseForm
          groupId={groupId}
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          members={members}
          onOptimisticAdd={handleOptimisticAdd}
          onSettled={handleAddSettled}
          onOptimisticActivity={onOptimisticActivity}
        />
      </div>

      {expenses.length === 0 ? (
        needsMembers ? (
          /* Empty state: solo group — encourage inviting people */
          <Card className="px-5 py-10 text-center">
            <svg className="mx-auto h-10 w-10 text-amber-300 dark:text-amber-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="font-semibold text-stone-700 dark:text-stone-200 mb-1">Invite your group</p>
            <p className="text-sm text-stone-400 dark:text-stone-500 mb-4">Share the invite link so friends can join and start splitting expenses together.</p>
            <button
              onClick={share}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-700 hover:shadow active:scale-[0.97] cursor-pointer dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-900"
            >
              {canShare ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M12 15V2.25m0 0 3 3m-3-3-3 3" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.656a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.343 8.69" />
                </svg>
              )}
              {copied ? "Copied!" : canShare ? "Share invite link" : "Copy invite link"}
            </button>
          </Card>
        ) : (
          /* Empty state: has members — encourage adding expense */
          <Card className="px-5 py-10 text-center">
            <svg className="mx-auto h-10 w-10 text-stone-300 dark:text-stone-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m3 2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2z" />
            </svg>
            <p className="font-semibold text-stone-700 dark:text-stone-200 mb-1">No expenses yet</p>
            <p className="text-sm text-stone-400 dark:text-stone-500 mb-4">Add your first expense to start splitting costs.</p>
            <AddExpenseForm
              groupId={groupId}
              currentUserId={currentUserId}
              currentUserDisplayName={currentUserDisplayName}
              members={members}
              onOptimisticAdd={handleOptimisticAdd}
              onSettled={handleAddSettled}
              onOptimisticActivity={onOptimisticActivity}
            />
          </Card>
        )
      ) : (
        <ul className="space-y-2">
          {expenses.slice(0, displayCount).map((expense) => {
            const personalContext = getPersonalContext(expense, currentUserId);
            const payerName = expense.paidById === currentUserId
              ? "you"
              : getMemberPillProps(expense.paidById, members, allUserNames).name;
            const payerLine = `${payerName} paid ${formatCents(expense.amountCents)}`;
            const paymentDirection = expense.isPayment
              ? getPaymentDirection(expense, currentUserId, members, allUserNames)
              : null;
            const dateParts = formatDateBlock(expense.date);

            const isSettledUp = expense.isPayment && expense.settledUp;

            // Left accent bar color
            const accentColor = expense.isPayment
              ? "border-l-stone-200 dark:border-l-stone-700"
              : personalContext?.positive
                ? "border-l-emerald-500"
                : personalContext
                  ? "border-l-rose-400"
                  : "border-l-stone-200 dark:border-l-stone-700";

            // Payment row background tint
            const paymentBg = isSettledUp
              ? "bg-emerald-50/40 dark:bg-emerald-950/20"
              : expense.isPayment
                ? "bg-amber-50/40 dark:bg-amber-950/20"
                : "";

            return (
              <li
                key={expense.id}
                className={removingIds.has(expense.id) ? "expense-item-exit" : "expense-item-enter"}
              >
                <button
                  type="button"
                  className="w-full text-left rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  onClick={() => setOpenDetailExpenseId(expense.id)}
                >
                  <Card
                    className={`px-3 sm:px-4 py-3 border-l-[3px] ${accentColor} ${paymentBg} ${expense.isPending ? "opacity-60" : ""} hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Date block */}
                      <div className="flex flex-col items-center w-9 shrink-0 text-center">
                        <span className="text-[9px] font-bold tracking-wider text-stone-400 dark:text-stone-500 leading-none">
                          {dateParts.month}
                        </span>
                        <span className="text-sm font-bold text-stone-600 dark:text-stone-300 leading-tight mt-px">
                          {dateParts.day}
                        </span>
                      </div>

                      {/* Vertical divider */}
                      <div className="w-px h-7 bg-stone-200 dark:bg-stone-700 shrink-0" />

                      {/* Info: title + subtitle */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isSettledUp ? "text-emerald-700 dark:text-emerald-400" : "text-stone-900 dark:text-stone-100"}`}>
                          {isSettledUp ? (
                            <>{getSettledUpTitle(expense, members, allUserNames)} ✨</>
                          ) : expense.isPayment ? (
                            <>{paymentDirection}</>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {expense.description}
                              {expense.recurringExpense && (
                                <svg
                                  className="inline w-3.5 h-3.5 shrink-0 text-amber-400 dark:text-amber-500"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-label="Recurring"
                                >
                                  <path d="M17 1l4 4-4 4" />
                                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                  <path d="M7 23l-4-4 4-4" />
                                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                </svg>
                              )}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 truncate">
                          {expense.isPayment ? `Payment · ${formatCents(expense.amountCents)}` : payerLine}
                        </p>
                      </div>

                      {/* Right: personal stake (expenses) or amount (payments) + chevron */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {expense.isPayment ? (
                          <span className="text-base font-bold whitespace-nowrap text-amber-700 dark:text-amber-400">
                            {formatCents(expense.amountCents)}
                          </span>
                        ) : personalContext ? (
                          <div className="text-right">
                            <p className={`text-xs leading-none ${
                              personalContext.positive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-500 dark:text-rose-400"
                            }`}>
                              {personalContext.label}
                            </p>
                            <p className={`text-base font-bold leading-tight mt-px whitespace-nowrap ${
                              personalContext.positive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-500 dark:text-rose-400"
                            }`}>
                              {formatCents(personalContext.amountCents)}
                            </p>
                          </div>
                        ) : null}
                        <svg
                          className="w-4 h-4 text-stone-300 dark:text-stone-600 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {expenses.length > displayCount && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setDisplayCount((c) => c + 30)}
            className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors"
          >
            Show {Math.min(expenses.length - displayCount, 30)} more
          </button>
        </div>
      )}

      {/* Detail / edit modal — rendered once at list level */}
      {openDetailExpenseId && (() => {
        const expense = expenses.find((e) => e.id === openDetailExpenseId);
        if (!expense) return null;
        return (
          <ExpenseDetailModal
            groupId={groupId}
            expense={expense}
            members={members}
            allUserNames={allUserNames}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            onClose={() => setOpenDetailExpenseId(null)}
            onOptimisticDelete={handleOptimisticDelete}
            onDeleteFailed={handleDeleteFailed}
            onDeleteSettled={handleDeleteSettled}
            onOptimisticUpdate={handleOptimisticUpdate}
            onUpdateSettled={handleUpdateSettled}
            onOptimisticActivity={onOptimisticActivity}
          />
        );
      })()}

      {/* Floating action button — appears when inline buttons scroll out of view */}
      <AddExpenseForm
        groupId={groupId}
        currentUserId={currentUserId}
        currentUserDisplayName={currentUserDisplayName}
        members={members}
        onOptimisticAdd={handleOptimisticAdd}
        onSettled={handleAddSettled}
        onOptimisticActivity={onOptimisticActivity}
        renderTrigger={({ onClick, loading }) => (
          <button
            onClick={onClick}
            disabled={loading}
            aria-label="Add expense"
            className={`fab-button fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/25 transition-all duration-300 ease-out hover:bg-amber-600 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.94] disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:hover:bg-amber-400 dark:shadow-amber-500/20 ${
              fabVisible ? "fab-enter" : "fab-exit pointer-events-none"
            } w-14 h-14 justify-center px-0 sm:w-auto sm:h-12 ${
              fabCompact
                ? "sm:w-12 sm:h-12 sm:justify-center sm:px-0"
                : "sm:px-5"
            }`}
            style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <svg
              className={`shrink-0 transition-transform duration-300 w-6 h-6 sm:w-4 sm:h-4 ${fabCompact ? "sm:w-5 sm:h-5" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span
              className={`whitespace-nowrap text-sm transition-all duration-300 overflow-hidden hidden sm:inline ${
                fabCompact ? "sm:w-0 sm:opacity-0" : "sm:w-auto sm:opacity-100"
              }`}
            >
              {loading ? "Adding\u2026" : "Add expense"}
            </span>
          </button>
        )}
      />
    </section>
  );
}
