"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { DashboardAddExpenseForm } from "./DashboardAddExpenseForm";
import type { DashboardContact } from "./DashboardAddExpenseForm";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { formatCents } from "@/lib/format";
import { splitAmount } from "@/lib/balances/splitAmount";

export interface FriendInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  emoji: string | null;
  groupId: string;
  balance: number;
  hasExpenses: boolean;
}

interface DashboardFriendsProps {
  currentUserId: string;
  currentUserDisplayName: string;
  contacts: DashboardContact[];
  initialFriends: FriendInfo[];
}

export function DashboardFriends({
  currentUserId,
  currentUserDisplayName,
  contacts,
  initialFriends,
}: DashboardFriendsProps) {
  const [friends, setFriends] = useState(initialFriends);

  const handleExpenseCreated = useCallback(
    (expense: {
      friendUserId: string;
      friendGroupId: string;
      amountCents: number;
      paidById: string;
      splitType: "equal" | "custom";
      customSplits?: Array<{ userId: string; amountCents: number }>;
    }) => {
      // Compute balance change
      let myShare: number;
      let friendShare: number;

      if (expense.splitType === "custom" && expense.customSplits) {
        myShare = expense.customSplits.find((s) => s.userId === currentUserId)?.amountCents ?? 0;
        friendShare = expense.customSplits.find((s) => s.userId === expense.friendUserId)?.amountCents ?? 0;
      } else {
        const shares = splitAmount(expense.amountCents, 2);
        myShare = shares[0]!;
        friendShare = shares[1]!;
      }

      // Balance change: positive = they owe me, negative = I owe them
      // If I paid: friend owes me their share → +friendShare
      // If friend paid: I owe them my share → -myShare
      const balanceDelta =
        expense.paidById === currentUserId ? friendShare : -myShare;

      setFriends((prev) => {
        const idx = prev.findIndex((f) => f.userId === expense.friendUserId);
        if (idx >= 0) {
          // Update existing friend
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx]!,
            balance: updated[idx]!.balance + balanceDelta,
            hasExpenses: true,
            groupId: expense.friendGroupId || updated[idx]!.groupId,
          };
          return updated;
        }

        // New friend — add to list
        const contact = contacts.find((c) => c.userId === expense.friendUserId);
        return [
          ...prev,
          {
            userId: expense.friendUserId,
            displayName: contact?.displayName ?? "Unknown",
            avatarUrl: contact?.avatarUrl ?? null,
            emoji: contact?.emoji ?? null,
            groupId: expense.friendGroupId,
            balance: balanceDelta,
            hasExpenses: true,
          },
        ];
      });
    },
    [currentUserId, contacts]
  );

  const visibleFriends = friends.filter((f) => f.hasExpenses);

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl sm:text-lg font-bold tracking-tight text-stone-900 dark:text-white">Friends</h2>
          <DashboardAddExpenseForm
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            contacts={contacts}
            onExpenseCreated={handleExpenseCreated}
          />
        </div>
      </div>

      {visibleFriends.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/60 bg-stone-50/50 px-5 py-8 text-center dark:border-stone-700/40 dark:bg-stone-900/20">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {contacts.length > 0
              ? "Add an expense with a friend to start tracking debts individually."
              : "Join a group with others to start adding friend expenses."}
          </p>
        </div>
      ) : (
        <div>
          {visibleFriends.map((friend, i) => (
            <Link
              key={friend.groupId}
              href={`/groups/${friend.groupId}`}
              prefetch={false}
              className={`group-card group flex items-center gap-3 py-3.5 transition-colors duration-150 hover:bg-stone-50 dark:hover:bg-stone-900/50 -mx-2 px-2${i < visibleFriends.length - 1 ? " border-b border-stone-100 dark:border-stone-800/60" : ""}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Avatar */}
              {friend.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={friend.avatarUrl}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <span className="text-lg">{friend.emoji ?? "🐦"}</span>
                </div>
              )}

              {/* Name */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base sm:text-[15px] font-semibold text-stone-900 dark:text-white">
                  {formatDisplayName(friend.displayName)}
                </p>
              </div>

              {/* Balance + chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {friend.balance !== 0 && (
                  <div className="text-right">
                    <p className={`text-[11px] ${
                      friend.balance > 0
                        ? "text-emerald-600/70 dark:text-emerald-400/70"
                        : "text-rose-600/70 dark:text-rose-400/70"
                    }`}>
                      {friend.balance > 0 ? "you are owed" : "you owe"}
                    </p>
                    <p className={`text-sm font-semibold ${
                      friend.balance > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {formatCents(Math.abs(friend.balance))}
                    </p>
                  </div>
                )}
                {friend.balance === 0 && friend.hasExpenses && (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      settled
                    </p>
                  </div>
                )}
                <svg
                  className="h-4 w-4 text-stone-300 dark:text-stone-600 transition-transform duration-150 group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
