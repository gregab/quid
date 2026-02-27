import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Trash2, Pencil, Repeat } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../../lib/auth";
import { useToast } from "../../../../../lib/toast";
import {
  useGroupDetail,
  useGroupExpenses,
  useUpdateExpense,
  useDeleteExpense,
  useStopRecurringExpense,
} from "../../../../../lib/queries";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";
import { Input } from "../../../../../components/ui/Input";
import { LoadingSpinner } from "../../../../../components/ui/LoadingSpinner";
import { ScreenHeader } from "../../../../../components/ui/ScreenHeader";
import {
  formatCents,
  formatDisplayName,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
  MAX_EXPENSE_DESCRIPTION,
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  filterAmountInput,
  formatAmountDisplay,
  stripAmountFormatting,
  splitAmount,
} from "../../../../../lib/queries/shared";
import type { Member, ExpenseRow } from "../../../../../lib/types";

type Mode = "view" | "edit";

export default function ExpenseDetailScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: group } = useGroupDetail(id!);
  const { data: expenses, isLoading } = useGroupExpenses(id!);
  const updateExpense = useUpdateExpense(id!);
  const deleteExpense = useDeleteExpense(id!);
  const stopRecurring = useStopRecurringExpense(id!);

  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>("view");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const startEdit = () => {
    if (!expense) return;
    setEditDescription(expense.description);
    setEditAmount(formatAmountDisplay(String(expense.amountCents / 100)));
    setMode("edit");
  };

  const handleUpdate = async () => {
    if (!expense) return;
    setError(null);

    const desc = editDescription.trim();
    if (!desc) { setError("Description is required."); return; }

    const parsedAmount = parseFloat(stripAmountFormatting(editAmount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError("Please enter a valid amount."); return; }
    const amountCents = Math.round(parsedAmount * 100);
    if (amountCents > MAX_AMOUNT_CENTS) { setError(`Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`); return; }

    const changes: Record<string, unknown> = {};
    if (desc !== expense.description) changes.description = { from: expense.description, to: desc };
    if (amountCents !== expense.amountCents) changes.amount = { from: expense.amountCents, to: amountCents };

    const beforeSplits = expense.splits.map((s) => ({ displayName: getMemberName(s.userId), amountCents: s.amountCents }));
    const ids = expense.participantIds;

    let newSplitAmounts: number[];
    if (expense.splitType === "custom") {
      if (amountCents !== expense.amountCents) {
        const ratio = amountCents / expense.amountCents;
        newSplitAmounts = expense.splits.map((s) => Math.round(s.amountCents * ratio));
        const diff = amountCents - newSplitAmounts.reduce((a, b) => a + b, 0);
        newSplitAmounts[newSplitAmounts.length - 1]! += diff;
      } else {
        newSplitAmounts = expense.splits.map((s) => s.amountCents);
      }
    } else {
      newSplitAmounts = splitAmount(amountCents, ids.length);
    }
    const afterSplits = ids.map((uid, i) => ({ displayName: getMemberName(uid), amountCents: newSplitAmounts[i]! }));

    try {
      await updateExpense.mutateAsync({
        expenseId: expense.id, groupId: id!, description: desc, amountCents,
        date: expense.date, paidById: expense.paidById, participantIds: ids, members,
        splitType: expense.splitType,
        splitAmounts: expense.splitType === "custom" ? newSplitAmounts : undefined,
        changes, splitsBefore: beforeSplits, splitsAfter: afterSplits,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    }
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
          <View className="flex-row gap-3">
            {expense.canEdit && mode === "view" && (
              <Pressable onPress={startEdit}>
                <Pencil size={20} color="#78716c" />
              </Pressable>
            )}
            {expense.canDelete && (
              <Pressable onPress={handleDelete}>
                <Trash2 size={20} color="#ef4444" />
              </Pressable>
            )}
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {mode === "view" ? (
            <View>
              <View className="mb-4 items-center pb-2 pt-4">
                <Text className="text-xl font-bold text-stone-900 dark:text-white">
                  {expense.isPayment ? "Payment" : expense.description}
                </Text>
                <Text className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-500">
                  {formatCents(expense.amountCents)}
                </Text>
                {expense.recurringExpense && (
                  <View className="mt-2 flex-row items-center gap-1 rounded-full bg-amber-50 px-3 py-1 dark:bg-amber-950/30">
                    <Repeat size={12} color="#d97706" />
                    <Text className="text-xs font-medium capitalize text-amber-700 dark:text-amber-400">
                      {expense.recurringExpense.frequency}
                    </Text>
                  </View>
                )}
              </View>

              <Card className="px-4 py-4">
                <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Details
                </Text>
                <View className="gap-2.5">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-stone-500 dark:text-stone-400">Date</Text>
                    <Text className="text-sm font-medium text-stone-700 dark:text-stone-300">{expense.date}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-stone-500 dark:text-stone-400">Paid by</Text>
                    <Text className="text-sm font-medium text-stone-700 dark:text-stone-300">
                      {expense.paidById === user?.id ? "You" : formatDisplayName(expense.paidByDisplayName)}
                    </Text>
                  </View>
                  {expense.splitType !== "equal" && (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-stone-500 dark:text-stone-400">Split type</Text>
                      <Text className="text-sm font-medium capitalize text-stone-700 dark:text-stone-300">{expense.splitType}</Text>
                    </View>
                  )}
                </View>
              </Card>

              <Card className="mt-3 px-4 py-4">
                <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Split breakdown
                </Text>
                {expense.splits.map((s) => {
                  const isYou = s.userId === user?.id;
                  const isPayer = s.userId === expense.paidById;
                  return (
                    <View key={s.userId} className="flex-row items-center justify-between py-1.5">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm text-stone-700 dark:text-stone-300">
                          {getMemberName(s.userId)}{isYou ? " (you)" : ""}
                        </Text>
                        {isPayer && (
                          <View className="rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-800">
                            <Text className="text-[10px] font-medium text-stone-500 dark:text-stone-400">paid</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {formatCents(s.amountCents)}
                      </Text>
                    </View>
                  );
                })}
              </Card>

              {expense.recurringExpense && (
                <Pressable
                  onPress={handleStopRecurring}
                  className="mt-3 items-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 active:opacity-80 dark:border-rose-900 dark:bg-rose-950/30"
                >
                  <Text className="text-sm font-medium text-rose-600 dark:text-rose-400">
                    Stop recurring
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View className="gap-4">
              <Input label="Description" value={editDescription} onChangeText={setEditDescription} maxLength={MAX_EXPENSE_DESCRIPTION} />
              <Input label="Amount ($)" value={editAmount} onChangeText={(text) => setEditAmount(filterAmountInput(text))} keyboardType="decimal-pad" />
              {error && <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button variant="secondary" onPress={() => setMode("view")}>Cancel</Button>
                </View>
                <View className="flex-1">
                  <Button onPress={handleUpdate} loading={updateExpense.isPending}>Save</Button>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
