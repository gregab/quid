import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Settings,
  Plus,
  CheckCircle,
  Link as LinkIcon,
  Repeat,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/auth";
import {
  useGroupDetail,
  useGroupExpenses,
  useActivityLogs,
} from "../../../../lib/queries";
import { Card } from "../../../../components/ui/Card";
import { MemberPill } from "../../../../components/ui/MemberPill";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import { Button } from "../../../../components/ui/Button";
import {
  buildRawDebts,
  simplifyDebts,
  formatDisplayName,
  formatCents,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
} from "../../../../lib/queries/shared";
import type {
  ExpenseRow,
  Member,
  ResolvedDebt,
  ActivityLog,
} from "../../../../lib/types";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const ACTION_TITLES: Record<string, string> = {
  expense_added: "Expense added",
  expense_edited: "Expense edited",
  expense_deleted: "Expense deleted",
  payment_recorded: "Payment recorded",
  payment_deleted: "Payment deleted",
};

function DebtLine({
  debt,
  currentUserId,
}: {
  debt: ResolvedDebt;
  currentUserId: string;
}) {
  const isOwing = debt.fromId === currentUserId;
  const isReceiving = debt.toId === currentUserId;
  const fromName = isOwing ? "You" : debt.fromName;
  const toName = isReceiving ? "you" : debt.toName;
  const verb = isOwing ? "owe" : "owes";

  const dotColor = isOwing
    ? "bg-rose-400"
    : isReceiving
      ? "bg-emerald-400"
      : "bg-stone-300";

  const amountColor = isOwing
    ? "text-red-600 dark:text-red-400"
    : isReceiving
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-stone-500 dark:text-stone-400";

  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <View className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <Text className="min-w-0 flex-1 text-sm text-stone-500 dark:text-stone-400">
        <Text
          className={
            isOwing || isReceiving
              ? "text-stone-700 dark:text-stone-200"
              : ""
          }
        >
          {fromName}
        </Text>{" "}
        {verb}{" "}
        <Text
          className={
            isOwing || isReceiving
              ? "text-stone-700 dark:text-stone-200"
              : ""
          }
        >
          {toName}
        </Text>
      </Text>
      <Text className={`text-sm font-semibold ${amountColor}`}>
        {formatCents(debt.amountCents)}
      </Text>
    </View>
  );
}

function ExpenseCard({
  expense,
  currentUserId,
  members,
  onPress,
}: {
  expense: ExpenseRow;
  currentUserId: string;
  members: Member[];
  onPress: () => void;
}) {
  const [year, month, day] = expense.date.split("-").map(Number);
  const dateObj = new Date(year!, month! - 1, day!);
  const monthStr = dateObj
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();

  // Personal context
  let contextLabel: string | null = null;
  let contextPositive = false;
  if (!expense.isPayment) {
    const mySplit = expense.splits.find((s) => s.userId === currentUserId);
    const amIPayer = expense.paidById === currentUserId;
    if (amIPayer && mySplit) {
      const lent = expense.amountCents - mySplit.amountCents;
      if (lent > 0) {
        contextLabel = `you lent ${formatCents(lent)}`;
        contextPositive = true;
      }
    } else if (!amIPayer && mySplit) {
      contextLabel = `you owe ${formatCents(mySplit.amountCents)}`;
    }
  }

  // Payment direction
  let paymentDirection: string | null = null;
  if (expense.isPayment) {
    const toId = expense.participantIds[0];
    const toMember = members.find((m) => m.userId === toId);
    const toName = toMember
      ? formatDisplayName(toMember.displayName)
      : UNKNOWN_USER;
    if (expense.paidById === currentUserId) {
      paymentDirection = `you paid ${toName}`;
    } else if (toId === currentUserId) {
      paymentDirection = `${formatDisplayName(expense.paidByDisplayName)} paid you`;
    } else {
      paymentDirection = `${formatDisplayName(expense.paidByDisplayName)} \u2192 ${toName}`;
    }
  }

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-stone-100 py-3 dark:border-stone-800/60"
    >
      {/* Date block */}
      <View className="w-10 items-center">
        <Text className="text-[10px] font-bold uppercase text-stone-400 dark:text-stone-500">
          {monthStr}
        </Text>
        <Text className="text-lg font-bold text-stone-700 dark:text-stone-300">
          {day}
        </Text>
      </View>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <Text
          className="text-sm font-semibold text-stone-900 dark:text-white"
          numberOfLines={1}
        >
          {expense.isPayment ? "Payment" : expense.description}
        </Text>
        {paymentDirection && (
          <Text className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {paymentDirection}
          </Text>
        )}
        {contextLabel && (
          <Text
            className={`mt-0.5 text-xs font-medium ${
              contextPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500 dark:text-rose-400"
            }`}
          >
            {contextLabel}
          </Text>
        )}
        {!expense.isPayment && (
          <Text className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
            Paid by {formatDisplayName(expense.paidByDisplayName)}
          </Text>
        )}
      </View>

      {/* Amount */}
      <Text className="text-sm font-semibold text-stone-700 dark:text-stone-300">
        {formatCents(expense.amountCents)}
      </Text>

      {/* Pending indicator */}
      {expense.isPending && (
        <View className="h-2 w-2 rounded-full bg-amber-400" />
      )}
    </Pressable>
  );
}

function ActivityItem({ log }: { log: ActivityLog }) {
  const title = ACTION_TITLES[log.action] ?? log.action;
  const payload = log.payload as Record<string, unknown> | null;

  let detail: string | null = null;
  if (payload) {
    if (payload.description) {
      detail = `${payload.description}`;
      if (payload.amountCents) {
        detail += ` \u2014 ${formatCents(payload.amountCents as number)}`;
      }
    } else if (payload.amountCents) {
      detail = formatCents(payload.amountCents as number);
    }
  }

  return (
    <View className="flex-row items-start gap-3 py-2.5">
      <View className="mt-0.5 h-1.5 w-1.5 rounded-full bg-stone-300 dark:bg-stone-600" />
      <View className="min-w-0 flex-1">
        <Text className="text-xs text-stone-500 dark:text-stone-400">
          <Text className="font-medium text-stone-700 dark:text-stone-300">
            {log.actor.displayName}
          </Text>
          {" \u2014 "}
          {title}
        </Text>
        {detail && (
          <Text
            className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500"
            numberOfLines={1}
          >
            {detail}
          </Text>
        )}
      </View>
      <Text className="text-[11px] text-stone-400 dark:text-stone-500">
        {formatRelativeTime(String(log.createdAt))}
      </Text>
    </View>
  );
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: group, isLoading: groupLoading } = useGroupDetail(id!);
  const {
    data: expenses,
    isLoading: expensesLoading,
    refetch: refetchExpenses,
  } = useGroupExpenses(id!);
  const {
    data: activityPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivityLogs(id!);

  const [refreshing, setRefreshing] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [showAllDebts, setShowAllDebts] = useState(false);

  // Build members array from group data
  const members: Member[] = useMemo(() => {
    if (!group) return [];
    const gm = (group as Record<string, unknown>).GroupMember as
      | Array<Record<string, unknown>>
      | null;
    return (gm ?? []).map((m, i) => {
      const u = m.User as Record<string, unknown> | null;
      return {
        userId: m.userId as string,
        displayName: (u?.displayName as string) ?? UNKNOWN_USER,
        emoji: MEMBER_EMOJIS[i % MEMBER_EMOJIS.length],
        avatarUrl: (u?.avatarUrl as string) ?? null,
      };
    });
  }, [group]);

  const inviteToken = (group as Record<string, unknown> | undefined)
    ?.inviteToken as string | undefined;

  // Compute debts
  const resolvedDebts: ResolvedDebt[] = useMemo(() => {
    if (!expenses || !user) return [];
    const simplified = simplifyDebts(buildRawDebts(expenses));
    const nameMap = new Map(
      members.map((m) => [m.userId, m.displayName]),
    );
    const debts = simplified.map((d) => ({
      fromId: d.from,
      fromName: formatDisplayName(nameMap.get(d.from) ?? UNKNOWN_USER),
      toId: d.to,
      toName: formatDisplayName(nameMap.get(d.to) ?? UNKNOWN_USER),
      amountCents: d.amount,
    }));
    return [...debts].sort((a, b) => {
      const aMe = a.fromId === user.id || a.toId === user.id;
      const bMe = b.fromId === user.id || b.toId === user.id;
      if (aMe && !bMe) return -1;
      if (!aMe && bMe) return 1;
      return 0;
    });
  }, [expenses, members, user]);

  const userDebts = resolvedDebts.filter(
    (d) => d.fromId === user?.id || d.toId === user?.id,
  );
  const otherDebts = resolvedDebts.filter(
    (d) => d.fromId !== user?.id && d.toId !== user?.id,
  );

  const netBalance = useMemo(() => {
    let total = 0;
    for (const d of resolvedDebts) {
      if (d.toId === user?.id) total += d.amountCents;
      if (d.fromId === user?.id) total -= d.amountCents;
    }
    return total;
  }, [resolvedDebts, user]);

  const activityLogs = useMemo(
    () => (activityPages?.pages ?? []).flat(),
    [activityPages],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchExpenses();
    setRefreshing(false);
  };

  const handleCelebration = useCallback((name: string) => {
    setCelebration(name);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCelebration(null), 3000);
  }, []);

  const handleShareInvite = async () => {
    if (!inviteToken) return;
    const url = `https://aviary.gregbigelow.com/invite/${inviteToken}`;
    try {
      await Share.share({ message: `Join my group on Aviary: ${url}` });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // User cancelled
    }
  };

  if (groupLoading || expensesLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner text="Loading group..." />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-500">Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupName = (group as Record<string, unknown>).name as string;
  const isFriendGroup = ((group as Record<string, unknown>).isFriendGroup as boolean) ?? false;

  // For friend groups, find the friend's display name
  const friendDisplayName = isFriendGroup
    ? (() => {
        const gm = (group as Record<string, unknown>).GroupMember as Array<Record<string, unknown>> | null;
        const friend = (gm ?? []).find((m) => m.userId !== user?.id);
        const u = friend?.User as Record<string, unknown> | null;
        return (u?.displayName as string) ?? groupName;
      })()
    : groupName;

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d97706"
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1"
          >
            <ChevronLeft size={20} color="#78716c" />
            <Text className="text-sm text-stone-500">Back</Text>
          </Pressable>
          {!isFriendGroup && (
            <Pressable
              onPress={() => router.push(`/(app)/groups/${id}/settings`)}
            >
              <Settings size={20} color="#78716c" />
            </Pressable>
          )}
        </View>

        {/* Group title */}
        <View className="px-4 pb-2 pt-3">
          <Text className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            {isFriendGroup ? friendDisplayName : groupName}
          </Text>
        </View>

        {/* Member pills — hidden for friend groups */}
        {!isFriendGroup && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 pb-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {members.map((m) => (
              <MemberPill
                key={m.userId}
                emoji={m.emoji ?? "🐦"}
                displayName={formatDisplayName(m.displayName)}
                isCurrentUser={m.userId === user?.id}
              />
            ))}
          </ScrollView>
        )}

        {/* Invite link — hidden for friend groups */}
        {!isFriendGroup && inviteToken && (
          <View className="px-4 pb-4">
            <Pressable
              onPress={handleShareInvite}
              className="flex-row items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
            >
              <LinkIcon size={14} color="#78716c" />
              <Text className="flex-1 text-xs text-stone-500 dark:text-stone-400">
                Share invite link
              </Text>
            </Pressable>
          </View>
        )}

        {/* Celebration banner */}
        {celebration && (
          <View className="mx-4 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
            <Text className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Settled up with {celebration}!
            </Text>
          </View>
        )}

        {/* Balance card */}
        <View className="px-4 pb-4">
          <Card className="px-4 py-3">
            <View className={resolvedDebts.length > 0 ? "mb-2" : ""}>
              {resolvedDebts.length === 0 ? (
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle size={16} color="#16a34a" />
                  <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    All settled up
                  </Text>
                </View>
              ) : netBalance > 0 ? (
                <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  You're owed {formatCents(netBalance)} total
                </Text>
              ) : netBalance < 0 ? (
                <Text className="text-sm font-semibold text-rose-500 dark:text-rose-400">
                  You owe {formatCents(Math.abs(netBalance))} total
                </Text>
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle size={16} color="#16a34a" />
                  <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    You're all settled up
                  </Text>
                </View>
              )}
            </View>
            {userDebts.map((d, i) => (
              <DebtLine key={i} debt={d} currentUserId={user!.id} />
            ))}
            {showAllDebts &&
              otherDebts.map((d, i) => (
                <DebtLine key={`o${i}`} debt={d} currentUserId={user!.id} />
              ))}
            {otherDebts.length > 0 && (
              <Pressable onPress={() => setShowAllDebts((v) => !v)}>
                <Text className="mt-1 text-xs font-medium text-stone-400 dark:text-stone-500">
                  {showAllDebts
                    ? "Show less"
                    : `Show all balances (${otherDebts.length} more)`}
                </Text>
              </Pressable>
            )}
          </Card>
        </View>

        {/* Expenses */}
        <View className="px-4 pb-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold tracking-tight text-stone-900 dark:text-white">
              Expenses
            </Text>
            <View className="flex-row gap-2">
              {!isFriendGroup && (
                <Pressable
                  onPress={() =>
                    router.push(`/(app)/groups/${id}/recurring`)
                  }
                  className="flex-row items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 dark:border-stone-700 dark:bg-stone-800"
                >
                  <Repeat size={12} color="#78716c" />
                  <Text className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                    Recurring
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  router.push(`/(app)/groups/${id}/record-payment`)
                }
                className="flex-row items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-700 dark:bg-emerald-900/30"
              >
                <CheckCircle size={12} color="#16a34a" />
                <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Settle up
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(`/(app)/groups/${id}/add-expense`)
                }
                className="flex-row items-center gap-1 rounded-full bg-amber-600 px-3 py-1.5 dark:bg-amber-500"
              >
                <Plus size={12} color="#fff" strokeWidth={3} />
                <Text className="text-xs font-semibold text-white">
                  Add
                </Text>
              </Pressable>
            </View>
          </View>

          {(expenses ?? []).length === 0 ? (
            <Card className="items-center px-4 py-8">
              <Text className="text-3xl">🧾</Text>
              <Text className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                No expenses yet. Add one to get started!
              </Text>
            </Card>
          ) : (
            (expenses ?? []).map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                currentUserId={user!.id}
                members={members}
                onPress={() =>
                  router.push(
                    `/(app)/groups/${id}/expense/${expense.id}`,
                  )
                }
              />
            ))
          )}
        </View>

        {/* Activity feed */}
        <View className="px-4 pb-4">
          <Text className="mb-3 text-lg font-bold tracking-tight text-stone-900 dark:text-white">
            Activity
          </Text>
          {activityLogs.length === 0 ? (
            <Text className="text-sm text-stone-400 dark:text-stone-500">
              No activity yet.
            </Text>
          ) : (
            <>
              {activityLogs.map((log) => (
                <ActivityItem key={log.id} log={log} />
              ))}
              {hasNextPage && (
                <Button
                  variant="ghost"
                  onPress={() => void fetchNextPage()}
                  loading={isFetchingNextPage}
                >
                  Load more
                </Button>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
