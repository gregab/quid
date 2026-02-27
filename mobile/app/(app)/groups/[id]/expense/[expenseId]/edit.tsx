import { useMemo } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../../../lib/auth";
import { useToast } from "../../../../../../lib/toast";
import {
  useGroupDetail,
  useGroupExpenses,
  useUpdateExpense,
} from "../../../../../../lib/queries";
import { LoadingSpinner } from "../../../../../../components/ui/LoadingSpinner";
import { ScreenHeader } from "../../../../../../components/ui/ScreenHeader";
import { ExpenseForm } from "../../../../../../components/ExpenseForm";
import type { ExpenseFormData } from "../../../../../../components/ExpenseForm";
import {
  formatDisplayName,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
  splitAmount,
} from "../../../../../../lib/queries/shared";
import type { Member } from "../../../../../../lib/types";

export default function EditExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: group } = useGroupDetail(id!);
  const { data: expenses, isLoading } = useGroupExpenses(id!);
  const updateExpense = useUpdateExpense(id!);
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

  const initialData = useMemo(() => {
    if (!expense) return undefined;
    return {
      description: expense.description,
      amountCents: expense.amountCents,
      date: expense.date,
      paidById: expense.paidById,
      participantIds: expense.participantIds,
      splitType: expense.splitType as "equal" | "custom",
      splitAmounts:
        expense.splitType === "custom"
          ? expense.participantIds.map((uid) => {
              const s = expense.splits.find((sp) => sp.userId === uid);
              return s?.amountCents ?? 0;
            })
          : undefined,
    };
  }, [expense]);

  const handleUpdate = async (data: ExpenseFormData) => {
    if (!expense) return;

    const {
      description,
      amountCents,
      date,
      paidById,
      participantIds,
      splitType,
      splitAmounts,
    } = data;

    // Build change log
    const changes: Record<string, unknown> = {};
    if (description !== expense.description)
      changes.description = { from: expense.description, to: description };
    if (amountCents !== expense.amountCents)
      changes.amount = { from: expense.amountCents, to: amountCents };
    if (date !== expense.date)
      changes.date = { from: expense.date, to: date };
    if (paidById !== expense.paidById)
      changes.paidBy = {
        from: getMemberName(expense.paidById),
        to: getMemberName(paidById),
      };

    // Build before/after splits for activity log
    const splitsBefore = expense.splits.map((s) => ({
      displayName: getMemberName(s.userId),
      amountCents: s.amountCents,
    }));

    let newSplitAmounts: number[];
    if (splitType === "custom" && splitAmounts) {
      newSplitAmounts = splitAmounts;
    } else {
      newSplitAmounts = splitAmount(amountCents, participantIds.length);
    }

    const splitsAfter = participantIds.map((uid, i) => ({
      displayName: getMemberName(uid),
      amountCents: newSplitAmounts[i]!,
    }));

    await updateExpense.mutateAsync({
      expenseId: expense.id,
      groupId: id!,
      description,
      amountCents,
      date,
      paidById,
      participantIds,
      members,
      splitType,
      splitAmounts: splitType === "custom" ? newSplitAmounts : undefined,
      changes,
      splitsBefore,
      splitsAfter,
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!expense || !initialData) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-500">Expense not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <ScreenHeader
        title="Edit expense"
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ExpenseForm
          members={members}
          currentUserId={user?.id ?? ""}
          onSubmit={handleUpdate}
          isLoading={updateExpense.isPending}
          submitLabel="Save changes"
          showRecurring={false}
          initialData={initialData}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
