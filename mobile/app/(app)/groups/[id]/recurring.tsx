import { View, Text, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Square } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  useRecurringExpenses,
  useStopRecurringExpense,
} from "../../../../lib/queries";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import { formatCents } from "../../../../lib/queries/shared";
import type { RecurringExpenseRow } from "../../../../lib/queries/recurring";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function RecurringExpenseItem({
  item,
  onStop,
  stopping,
}: {
  item: RecurringExpenseRow;
  onStop: (id: string) => void;
  stopping: boolean;
}) {
  const handleStop = () => {
    Alert.alert(
      "Stop Recurring Expense",
      `Stop "${item.description}" from generating new expenses? Past expenses won't be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () => onStop(item.id),
        },
      ],
    );
  };

  return (
    <Card className="mb-3 px-4 py-3">
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1">
          <Text
            className="text-sm font-semibold text-stone-900 dark:text-white"
            numberOfLines={1}
          >
            {item.description}
          </Text>
          <Text className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {formatCents(item.amountCents)} {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
          </Text>
          <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            Paid by {item.paidByDisplayName}
          </Text>
          <Text className="mt-1 text-xs text-stone-400 dark:text-stone-500">
            Next due: {item.nextDueDate}
          </Text>
        </View>
        <Pressable
          onPress={handleStop}
          disabled={stopping}
          className="ml-3 flex-row items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 dark:border-rose-700 dark:bg-rose-900/30"
        >
          <Square size={10} color="#e11d48" fill="#e11d48" />
          <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300">
            {stopping ? "Stopping..." : "Stop"}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function RecurringExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: recurring, isLoading } = useRecurringExpenses(id!);
  const stopMutation = useStopRecurringExpense(id!);

  const handleStop = (recurringId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopMutation.mutate(recurringId);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1"
        >
          <ChevronLeft size={20} color="#78716c" />
          <Text className="text-sm text-stone-500">Back</Text>
        </Pressable>
      </View>

      <View className="px-4 pb-4">
        <Text className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          Recurring Expenses
        </Text>
        <Text className="mt-1 text-xs text-stone-400 dark:text-stone-500">
          Active recurring expenses that automatically generate new expenses.
        </Text>
      </View>

      {isLoading ? (
        <LoadingSpinner text="Loading recurring expenses..." />
      ) : (recurring ?? []).length === 0 ? (
        <View className="px-4">
          <EmptyState
            icon={<Text className="text-2xl">🔄</Text>}
            title="No recurring expenses"
            subtitle={'Create one from the "Add Expense" screen by toggling "Recurring".'}
          />
        </View>
      ) : (
        <View className="px-4">
          {(recurring ?? []).map((item) => (
            <RecurringExpenseItem
              key={item.id}
              item={item}
              onStop={handleStop}
              stopping={
                stopMutation.isPending &&
                stopMutation.variables === item.id
              }
            />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
