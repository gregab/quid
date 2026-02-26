import { useMemo } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/auth";
import { useGroupDetail, useCreateExpense } from "../../../../lib/queries";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import { UNKNOWN_USER, MEMBER_EMOJIS } from "../../../../lib/queries/shared";
import { ExpenseForm, type ExpenseFormData } from "../../../../components/ExpenseForm";
import type { Member } from "../../../../lib/types";

/** Extract members from group detail response. Shared between add-expense and record-payment. */
export function extractMembers(group: Record<string, unknown> | null | undefined): Member[] {
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
}

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { data: group, isLoading } = useGroupDetail(id!);
  const createExpense = useCreateExpense(id!);

  const members = useMemo(() => extractMembers(group as Record<string, unknown> | null), [group]);

  const handleSubmit = async (data: ExpenseFormData) => {
    await createExpense.mutateAsync({
      groupId: id!,
      description: data.description,
      amountCents: data.amountCents,
      date: data.date,
      paidById: data.paidById,
      participantIds: data.participantIds,
      members,
      splitType: data.splitType,
      splitAmounts: data.splitAmounts,
      recurringFrequency: data.recurringFrequency,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View
          style={{ paddingTop: insets.top + 8 }}
          className="flex-row items-center justify-between border-b border-stone-100 px-4 pb-3 dark:border-stone-800/60"
        >
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1"
          >
            <ChevronLeft size={20} color="#78716c" />
            <Text className="text-sm text-stone-500">Cancel</Text>
          </Pressable>
          <Text className="text-base font-semibold text-stone-900 dark:text-white">
            Add expense
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ExpenseForm
          members={members}
          currentUserId={user!.id}
          onSubmit={handleSubmit}
          isLoading={createExpense.isPending}
          showRecurring
        />
      </KeyboardAvoidingView>
    </View>
  );
}
