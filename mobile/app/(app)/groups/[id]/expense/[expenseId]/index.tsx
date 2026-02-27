import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Repeat } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../../../lib/auth";
import { useToast } from "../../../../../../lib/toast";
import {
  useGroupDetail,
  useGroupExpenses,
  useDeleteExpense,
  useStopRecurringExpense,
} from "../../../../../../lib/queries";
import { LoadingSpinner } from "../../../../../../components/ui/LoadingSpinner";
import { ScreenHeader } from "../../../../../../components/ui/ScreenHeader";
import {
  formatCents,
  formatDisplayName,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
} from "../../../../../../lib/queries/shared";
import type { Member } from "../../../../../../lib/types";

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateTime(isoStr: string): string {
  const date = new Date(isoStr);
  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

export default function ExpenseDetailScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: group } = useGroupDetail(id!);
  const { data: expenses, isLoading } = useGroupExpenses(id!);
  const deleteExpense = useDeleteExpense(id!);
  const stopRecurring = useStopRecurringExpense(id!);

  const { showToast } = useToast();

  const expense = useMemo(
    () => (expenses ?? []).find((e) => e.id === expenseId),
    [expenses, expenseId],
  );

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
      };
    });
  }, [group]);

  const getMemberName = (userId: string): string => {
    const m = members.find((mem) => mem.userId === userId);
    return m ? formatDisplayName(m.displayName) : UNKNOWN_USER;
  };

  const handleStopRecurring = () => {
    if (!expense?.recurringExpense) return;
    Alert.alert(
      "Stop recurring expense",
      "Future auto-generated expenses will be cancelled. Existing expenses are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop recurring",
          style: "destructive",
          onPress: async () => {
            try {
              await stopRecurring.mutateAsync(expense.recurringExpense!.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              showToast({
                message: err instanceof Error ? err.message : "Failed to stop recurring.",
                type: "error",
              });
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!expense) return;
    Alert.alert(
      "Delete expense",
      `Are you sure you want to delete "${expense.isPayment ? "this payment" : expense.description}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteExpense.mutateAsync({
                expenseId: expense.id, description: expense.description, amountCents: expense.amountCents,
                paidByDisplayName: expense.paidByDisplayName, date: expense.date,
                participantDisplayNames: expense.participantIds.map(getMemberName),
              });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              showToast({
                message: err instanceof Error ? err.message : "Failed to delete.",
                type: "error",
              });
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-500">Expense not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const payerName = formatDisplayName(expense.paidByDisplayName);
  const recipientId = expense.participantIds[0];
  const recipientName = recipientId ? getMemberName(recipientId) : "Unknown";

  const splitsForDisplay = expense.splits.length > 0 ? expense.splits : [];

  const createdByName = expense.createdById
    ? expense.createdById === user?.id
      ? "you"
      : getMemberName(expense.createdById)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <ScreenHeader
        title=""
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 gap-5">
          {/* ── Header ── */}
          <View className="gap-1 pt-1">
            <Text className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              {expense.isPayment ? "Payment" : "Expense"}
            </Text>
            <Text className="text-2xl font-bold text-stone-900 dark:text-white">
              {expense.isPayment
                ? `${payerName} → ${recipientName}`
                : expense.description}
            </Text>
            <Text className="text-sm text-stone-400 dark:text-stone-500">
              {formatDisplayDate(expense.date)}
            </Text>
            {expense.recurringExpense && (
              <View className="mt-1 flex-row items-center gap-1.5 self-start rounded-full bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30">
                <Repeat size={12} color="#d97706" />
                <Text className="text-xs font-semibold capitalize tracking-wide text-amber-700 dark:text-amber-400">
                  {expense.recurringExpense.frequency}
                </Text>
              </View>
            )}
          </View>

          {expense.isPayment ? (
            /* ── Payment: amount display ── */
            <View className="flex-row items-baseline gap-1.5">
              <Text className="text-2xl font-bold text-stone-900 dark:text-white">
                {formatCents(expense.amountCents)}
              </Text>
              <Text className="text-sm text-stone-400 dark:text-stone-500">
                · {formatDisplayDate(expense.date)}
              </Text>
            </View>
          ) : (
            /* ── Expense: paid by + split breakdown ── */
            <View className="gap-4">
              {/* Paid by */}
              <View className="gap-1.5">
                <Text className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  Paid by
                </Text>
                <View className="flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/20">
                  <Text className="text-base font-semibold text-stone-900 dark:text-white">
                    {payerName}{expense.paidById === user?.id ? " (you)" : ""}
                  </Text>
                  <Text className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {formatCents(expense.amountCents)}
                  </Text>
                </View>
              </View>

              {/* Split breakdown */}
              {splitsForDisplay.length > 0 && (
                <View className="gap-1.5">
                  <Text className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                    Split{expense.splitType === "custom" ? " · custom" : ""}
                  </Text>
                  <View className="gap-3">
                    {splitsForDisplay.map((split) => {
                      const isYou = split.userId === user?.id;
                      const isPayer = split.userId === expense.paidById;
                      const widthPct =
                        expense.amountCents > 0
                          ? (split.amountCents / expense.amountCents) * 100
                          : 0;
                      return (
                        <View key={split.userId}>
                          <View className="flex-row items-center justify-between mb-1.5">
                            <View className="flex-row items-center gap-1.5 min-w-0 flex-1">
                              <Text
                                className="text-sm font-medium text-stone-800 dark:text-stone-200"
                                numberOfLines={1}
                              >
                                {getMemberName(split.userId)}{isYou ? " (you)" : ""}
                              </Text>
                              {isPayer && (
                                <View className="rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-900/40">
                                  <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                    paid
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-sm font-semibold text-stone-900 dark:text-stone-100 ml-3 shrink-0">
                              {formatCents(split.amountCents)}
                            </Text>
                          </View>
                          <View className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                            <View
                              className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
                              style={{ width: `${widthPct}%` }}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Added by metadata ── */}
          {(createdByName || expense.createdAt) && (
            <View className="gap-0.5">
              {(createdByName || expense.createdAt) && (
                <Text className="text-xs text-stone-400 dark:text-stone-500">
                  {expense.isPayment ? "Recorded by " : "Added by "}
                  <Text className="font-medium">{createdByName ?? "unknown"}</Text>
                  {expense.createdAt ? ` · ${formatDateTime(expense.createdAt)}` : ""}
                </Text>
              )}
              {expense.updatedAt && (
                <Text className="text-xs text-stone-400 dark:text-stone-500">
                  Last edited · {formatDateTime(expense.updatedAt)}
                </Text>
              )}
            </View>
          )}

          {/* ── Recurring widget ── */}
          {expense.recurringExpense && (
            <View className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20">
              <View className="flex-row items-center justify-between gap-2 px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Repeat size={16} color="#d97706" />
                  <Text className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Recurring · {expense.recurringExpense.frequency}
                  </Text>
                </View>
                <Pressable
                  onPress={handleStopRecurring}
                  className="active:opacity-70"
                >
                  <Text className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    Stop recurring
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Action row ── */}
          <View className="flex-row items-center justify-between gap-3 border-t border-stone-100 pt-4 dark:border-stone-800/60">
            {expense.canDelete ? (
              <Pressable
                onPress={handleDelete}
                className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 active:opacity-75 dark:border-rose-900 dark:bg-rose-950/30"
              >
                <Text className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  Delete {expense.isPayment ? "payment" : "expense"}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}

            {expense.canEdit && (
              <Pressable
                onPress={() =>
                  router.push(
                    `/(app)/groups/${id}/expense/${expenseId}/edit` as never,
                  )
                }
                className="flex-row items-center gap-1.5 rounded-xl border border-amber-500 bg-amber-600 px-5 py-3 active:opacity-80 dark:bg-amber-500"
              >
                <Text className="text-sm font-bold text-white">Edit</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
