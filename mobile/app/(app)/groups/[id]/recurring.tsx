import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Square, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  useRecurringExpenses,
  useStopRecurringExpense,
} from "../../../../lib/queries";
import { Card } from "../../../../components/ui/Card";
import { ScreenHeader } from "../../../../components/ui/ScreenHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import { Button } from "../../../../components/ui/Button";
import { formatCents } from "../../../../lib/queries/shared";
import type { RecurringExpenseRow } from "../../../../lib/queries/recurring";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const FREQUENCY_COLORS: Record<string, { bg: string; text: string }> = {
  weekly: {
    bg: "bg-sky-100 dark:bg-sky-900/30",
    text: "text-sky-700 dark:text-sky-300",
  },
  monthly: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  yearly: {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    text: "text-violet-700 dark:text-violet-300",
  },
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

  const freq = FREQUENCY_COLORS[item.frequency] ?? FREQUENCY_COLORS.monthly!;

  return (
    <Card className="mb-3 px-4 py-3.5">
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1">
          <View className="mb-1.5 flex-row items-center gap-2">
            <Text
              className="text-sm font-semibold text-stone-900 dark:text-white"
              numberOfLines={1}
            >
              {item.description}
            </Text>
            <View className={`rounded-full px-2 py-0.5 ${freq.bg}`}>
              <Text className={`text-[10px] font-bold uppercase tracking-wide ${freq.text}`}>
                {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
              </Text>
            </View>
          </View>
          <Text className="text-base font-bold text-stone-800 dark:text-stone-100">
            {formatCents(item.amountCents)}
          </Text>
          <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            Paid by {item.paidByDisplayName}
          </Text>
          <Text className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Next due {item.nextDueDate}
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
      <ScreenHeader
        title="Recurring Expenses"
        onBack={() => router.back()}
      />

      {isLoading ? (
        <LoadingSpinner text="Loading recurring expenses..." />
      ) : (recurring ?? []).length === 0 ? (
        <View className="flex-1 px-4 pt-6">
          <EmptyState
            icon={<Text className="text-2xl">🔄</Text>}
            title="No recurring expenses"
            subtitle={'Create one from the "Add Expense" screen by toggling "Recurring".'}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        >
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
        </ScrollView>
      )}

      {/* Add recurring button */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-stone-100 bg-[#faf9f7] px-4 pb-10 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]">
        <Button
          onPress={() => router.push(`/(app)/groups/${id}/add-expense`)}
          size="lg"
        >
          <View className="flex-row items-center gap-2">
            <Plus size={18} color="#fff" />
            <Text className="text-base font-semibold text-white">
              Add recurring expense
            </Text>
          </View>
        </Button>
      </View>
    </SafeAreaView>
  );
}
