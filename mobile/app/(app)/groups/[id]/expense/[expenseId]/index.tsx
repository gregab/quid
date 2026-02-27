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
import { Pencil, Repeat, Users } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../../../lib/auth";
import { useToast } from "../../../../../../lib/toast";
import {
  useGroupDetail,
  useGroupExpenses,
  useDeleteExpense,
  useStopRecurringExpense,
} from "../../../../../../lib/queries";
import { Card } from "../../../../../../components/ui/Card";
import { LoadingSpinner } from "../../../../../../components/ui/LoadingSpinner";
import { ScreenHeader } from "../../../../../../components/ui/ScreenHeader";
import {
  formatCents,
  formatDisplayName,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
} from "../../../../../../lib/queries/shared";
import type { Member } from "../../../../../../lib/types";

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

  const headerTitle = expense.isPayment ? "Payment" : "Expense";

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <ScreenHeader
        title={headerTitle}
        onBack={() => router.back()}
        rightAction={
          expense.canEdit ? (
            <Pressable
              onPress={() =>
                router.push(
                  `/(app)/groups/${id}/expense/${expenseId}/edit` as never,
                )
              }
              className="flex-row items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-1.5 active:opacity-70 dark:bg-stone-800"
            >
              <Pencil size={14} color="#78716c" />
              <Text className="text-xs font-medium text-stone-600 dark:text-stone-400">
                Edit
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero area */}
        <View className="items-center px-6 pb-6 pt-8">
          <Text className="mb-1 text-4xl font-bold text-amber-600 dark:text-amber-500">
            {formatCents(expense.amountCents)}
          </Text>
          {!expense.isPayment && (
            <Text className="mt-1 text-center text-xl font-semibold text-stone-900 dark:text-white">
              {expense.description}
            </Text>
          )}
          {expense.recurringExpense && (
            <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30">
              <Repeat size={12} color="#d97706" />
              <Text className="text-xs font-semibold capitalize tracking-wide text-amber-700 dark:text-amber-400">
                {expense.recurringExpense.frequency}
              </Text>
            </View>
          )}
        </View>

        <View className="px-4 gap-3">
          {/* Details card */}
          <Card className="overflow-hidden">
            <View className="px-4 pt-4 pb-1">
              <Text className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Details
              </Text>
            </View>
            <View className="px-4 pb-4 gap-0">
              <View className="flex-row items-center justify-between py-2.5 border-b border-stone-100 dark:border-stone-800/60">
                <Text className="text-sm text-stone-500 dark:text-stone-400">Date</Text>
                <Text className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  {expense.date}
                </Text>
              </View>
              <View className="flex-row items-center justify-between py-2.5 border-b border-stone-100 dark:border-stone-800/60">
                <Text className="text-sm text-stone-500 dark:text-stone-400">Paid by</Text>
                <View className="flex-row items-center gap-1.5">
                  {expense.paidById === user?.id && (
                    <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900/30">
                      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        you
                      </Text>
                    </View>
                  )}
                  <Text className="text-sm font-medium text-stone-800 dark:text-stone-200">
                    {expense.paidById === user?.id
                      ? formatDisplayName(expense.paidByDisplayName)
                      : formatDisplayName(expense.paidByDisplayName)}
                  </Text>
                </View>
              </View>
              {expense.splitType !== "equal" && (
                <View className="flex-row items-center justify-between py-2.5">
                  <Text className="text-sm text-stone-500 dark:text-stone-400">Split</Text>
                  <Text className="text-sm font-medium capitalize text-stone-800 dark:text-stone-200">
                    {expense.splitType}
                  </Text>
                </View>
              )}
            </View>
          </Card>

          {/* Split breakdown card */}
          <Card className="overflow-hidden">
            <View className="px-4 pt-4 pb-1">
              <View className="flex-row items-center gap-2 mb-3">
                <Users size={12} color="#a8a29e" />
                <Text className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  Split breakdown
                </Text>
              </View>
            </View>
            <View className="px-4 pb-4">
              {expense.splits.map((s, idx) => {
                const isYou = s.userId === user?.id;
                const isPayer = s.userId === expense.paidById;
                const isLast = idx === expense.splits.length - 1;
                return (
                  <View
                    key={s.userId}
                    className={`flex-row items-center justify-between py-3 ${
                      !isLast ? "border-b border-stone-100 dark:border-stone-800/60" : ""
                    }`}
                  >
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text
                        className="text-sm font-medium text-stone-800 dark:text-stone-200 flex-shrink"
                        numberOfLines={1}
                      >
                        {getMemberName(s.userId)}
                      </Text>
                      {isYou && (
                        <Text className="text-[10px] text-stone-400 dark:text-stone-500">
                          (you)
                        </Text>
                      )}
                      {isPayer && (
                        <View className="rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-800">
                          <Text className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
                            paid
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm font-semibold text-stone-900 dark:text-stone-100 ml-3">
                      {formatCents(s.amountCents)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Stop recurring */}
          {expense.recurringExpense && (
            <Pressable
              onPress={handleStopRecurring}
              className="items-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 active:opacity-75 dark:border-rose-900 dark:bg-rose-950/30"
            >
              <Text className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                Stop recurring
              </Text>
            </Pressable>
          )}

          {/* Delete button */}
          {expense.canDelete && (
            <Pressable
              onPress={handleDelete}
              className="items-center rounded-xl border border-stone-200 bg-white px-4 py-3.5 active:opacity-75 dark:border-stone-800 dark:bg-stone-900"
            >
              <Text className="text-sm font-semibold text-red-500 dark:text-red-400">
                Delete {expense.isPayment ? "payment" : "expense"}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
