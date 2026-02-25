import { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/auth";
import {
  useGroupDetail,
  useCreateExpense,
} from "../../../../lib/queries";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import {
  MAX_EXPENSE_DESCRIPTION,
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  filterAmountInput,
  formatAmountDisplay,
  stripAmountFormatting,
  splitAmount,
  percentagesToCents,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
  formatDisplayName,
} from "../../../../lib/queries/shared";
import type { Member } from "../../../../lib/types";

type SplitType = "equal" | "percentage" | "custom";

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroupDetail(id!);
  const createExpense = useCreateExpense(id!);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === "ios");
  const [paidById, setPaidById] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(),
  );
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customAmounts, setCustomAmounts] = useState<Map<string, string>>(
    new Map(),
  );
  const [percentages, setPercentages] = useState<Map<string, string>>(
    new Map(),
  );
  const [recurring, setRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    "weekly" | "monthly" | "yearly"
  >("monthly");
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Build members
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

  // Initialize defaults once
  if (members.length > 0 && !initialized.current) {
    initialized.current = true;
    if (!paidById) setPaidById(user?.id ?? members[0]!.userId);
    if (participantIds.size === 0)
      setParticipantIds(new Set(members.map((m) => m.userId)));
  }

  const parsedCents = useMemo(() => {
    const num = parseFloat(stripAmountFormatting(amount));
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }, [amount]);

  // Compute split amounts for display
  const splitDisplay = useMemo(() => {
    const ids = Array.from(participantIds);
    if (ids.length === 0 || parsedCents === 0) return new Map<string, number>();

    if (splitType === "equal") {
      const amounts = splitAmount(parsedCents, ids.length);
      return new Map(ids.map((id, i) => [id, amounts[i]!]));
    }
    if (splitType === "percentage") {
      return percentagesToCents(percentages, ids, parsedCents);
    }
    // custom
    return new Map(
      ids.map((id) => [
        id,
        Math.round(parseFloat(stripAmountFormatting(customAmounts.get(id) ?? "0")) * 100),
      ]),
    );
  }, [splitType, participantIds, parsedCents, percentages, customAmounts]);

  const customTotal = useMemo(() => {
    let total = 0;
    for (const v of splitDisplay.values()) total += v;
    return total;
  }, [splitDisplay]);

  const handleAmountBlur = () => {
    const num = parseFloat(stripAmountFormatting(amount));
    if (amount.trim() && !isNaN(num) && num > 0) {
      if (Math.round(num * 100) > MAX_AMOUNT_CENTS) {
        setAmountError(
          `Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`,
        );
      } else {
        setAmountError(null);
        setAmount(formatAmountDisplay(amount));
      }
    }
  };

  const toggleParticipant = (userId: string) => {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size > 1) next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);

    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (parsedCents <= 0) {
      setAmountError("Please enter a valid amount.");
      return;
    }
    if (parsedCents > MAX_AMOUNT_CENTS) {
      setAmountError(
        `Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`,
      );
      return;
    }
    if (participantIds.size === 0) {
      setError("At least one participant is required.");
      return;
    }

    const ids = Array.from(participantIds);
    let splitAmounts: number[] | undefined;

    if (splitType === "custom" || splitType === "percentage") {
      splitAmounts = ids.map((id) => splitDisplay.get(id) ?? 0);
      const sum = splitAmounts.reduce((a, b) => a + b, 0);
      if (sum !== parsedCents) {
        setError(
          `Split amounts must equal the total (${sum} vs ${parsedCents}).`,
        );
        return;
      }
    }

    const dateStr = date.toISOString().split("T")[0]!;

    try {
      await createExpense.mutateAsync({
        groupId: id!,
        description: description.trim(),
        amountCents: parsedCents,
        date: dateStr,
        paidById: paidById!,
        participantIds: ids,
        members,
        splitType,
        splitAmounts,
        recurringFrequency: recurring ? recurringFrequency : undefined,
      });
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create expense.",
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-5 flex-row items-center justify-between">
            <Text className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
              Add expense
            </Text>
            <Button variant="ghost" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>

          <View className="gap-4">
            {/* Description */}
            <Input
              label="Description"
              placeholder="What's this for?"
              value={description}
              onChangeText={setDescription}
              maxLength={MAX_EXPENSE_DESCRIPTION}
              autoFocus
            />

            {/* Amount */}
            <Input
              label="Amount ($)"
              placeholder="0.00"
              value={amount}
              onChangeText={(text) => {
                setAmount(filterAmountInput(text));
                setAmountError(null);
              }}
              onBlur={handleAmountBlur}
              keyboardType="decimal-pad"
              error={amountError ?? undefined}
            />

            {/* Date */}
            <View>
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Date
              </Text>
              {Platform.OS === "android" && (
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="rounded-lg border border-stone-300 px-3 py-2.5 dark:border-stone-700"
                >
                  <Text className="text-base text-stone-900 dark:text-stone-100">
                    {date.toLocaleDateString()}
                  </Text>
                </Pressable>
              )}
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === "ios" ? "compact" : "default"}
                  onChange={(_event, selectedDate) => {
                    if (Platform.OS === "android") setShowDatePicker(false);
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>

            {/* Paid by */}
            <View>
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Paid by
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {members.map((m) => (
                  <Pressable
                    key={m.userId}
                    onPress={() => setPaidById(m.userId)}
                    className={`rounded-full px-3 py-1.5 ${
                      paidById === m.userId
                        ? "bg-amber-600 dark:bg-amber-500"
                        : "bg-stone-100 dark:bg-stone-800"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        paidById === m.userId
                          ? "text-white"
                          : "text-stone-700 dark:text-stone-300"
                      }`}
                    >
                      {m.emoji} {formatDisplayName(m.displayName)}
                      {m.userId === user?.id ? " (you)" : ""}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Participants */}
            <View>
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Split between
              </Text>
              <View className="gap-1">
                {members.map((m) => {
                  const isSelected = participantIds.has(m.userId);
                  return (
                    <Pressable
                      key={m.userId}
                      onPress={() => toggleParticipant(m.userId)}
                      className={`flex-row items-center justify-between rounded-lg border px-3 py-2.5 ${
                        isSelected
                          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                          : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
                      }`}
                    >
                      <Text className="text-sm text-stone-900 dark:text-stone-100">
                        {m.emoji} {formatDisplayName(m.displayName)}
                        {m.userId === user?.id ? " (you)" : ""}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        {isSelected &&
                          parsedCents > 0 &&
                          splitType === "equal" && (
                            <Text className="text-xs text-stone-400">
                              {formatAmountDisplay(
                                String(
                                  (splitDisplay.get(m.userId) ?? 0) / 100,
                                ),
                              )}
                            </Text>
                          )}
                        <View
                          className={`h-5 w-5 items-center justify-center rounded ${
                            isSelected
                              ? "bg-amber-600 dark:bg-amber-500"
                              : "border border-stone-300 dark:border-stone-600"
                          }`}
                        >
                          {isSelected && (
                            <Text className="text-xs text-white">✓</Text>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Split type toggle */}
            <View>
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Split type
              </Text>
              <View className="flex-row gap-2">
                {(["equal", "custom", "percentage"] as const).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setSplitType(type)}
                    className={`flex-1 items-center rounded-lg py-2 ${
                      splitType === type
                        ? "bg-amber-600 dark:bg-amber-500"
                        : "bg-stone-100 dark:bg-stone-800"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium capitalize ${
                        splitType === type
                          ? "text-white"
                          : "text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {type === "percentage" ? "%" : type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Custom amounts */}
            {splitType === "custom" && (
              <View className="gap-2">
                {Array.from(participantIds).map((uid) => {
                  const m = members.find((mem) => mem.userId === uid);
                  return (
                    <View key={uid} className="flex-row items-center gap-2">
                      <Text
                        className="flex-1 text-sm text-stone-700 dark:text-stone-300"
                        numberOfLines={1}
                      >
                        {m?.emoji} {formatDisplayName(m?.displayName ?? UNKNOWN_USER)}
                      </Text>
                      <View className="w-24">
                        <Input
                          placeholder="0.00"
                          value={customAmounts.get(uid) ?? ""}
                          onChangeText={(text) => {
                            setCustomAmounts((prev) => {
                              const next = new Map(prev);
                              next.set(uid, filterAmountInput(text));
                              return next;
                            });
                          }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  );
                })}
                <Text
                  className={`text-xs ${
                    customTotal === parsedCents
                      ? "text-emerald-600"
                      : "text-rose-500"
                  }`}
                >
                  Total: {formatAmountDisplay(String(customTotal / 100))} /{" "}
                  {formatAmountDisplay(String(parsedCents / 100))}
                </Text>
              </View>
            )}

            {/* Percentages */}
            {splitType === "percentage" && (
              <View className="gap-2">
                {Array.from(participantIds).map((uid) => {
                  const m = members.find((mem) => mem.userId === uid);
                  return (
                    <View key={uid} className="flex-row items-center gap-2">
                      <Text
                        className="flex-1 text-sm text-stone-700 dark:text-stone-300"
                        numberOfLines={1}
                      >
                        {m?.emoji} {formatDisplayName(m?.displayName ?? UNKNOWN_USER)}
                      </Text>
                      <View className="w-20">
                        <Input
                          placeholder="0"
                          value={percentages.get(uid) ?? ""}
                          onChangeText={(text) => {
                            setPercentages((prev) => {
                              const next = new Map(prev);
                              next.set(uid, text.replace(/[^0-9]/g, ""));
                              return next;
                            });
                          }}
                          keyboardType="number-pad"
                        />
                      </View>
                      <Text className="text-xs text-stone-400">%</Text>
                    </View>
                  );
                })}
                {(() => {
                  let total = 0;
                  for (const uid of participantIds) {
                    total += parseInt(percentages.get(uid) ?? "0", 10) || 0;
                  }
                  return (
                    <Text
                      className={`text-xs ${
                        total === 100 ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      Total: {total}% / 100%
                    </Text>
                  );
                })()}
              </View>
            )}

            {/* Recurring */}
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-stone-700 dark:text-stone-300">
                Recurring expense
              </Text>
              <Switch
                value={recurring}
                onValueChange={setRecurring}
                trackColor={{ true: "#d97706" }}
              />
            </View>
            {recurring && (
              <View className="flex-row gap-2">
                {(["weekly", "monthly", "yearly"] as const).map((freq) => (
                  <Pressable
                    key={freq}
                    onPress={() => setRecurringFrequency(freq)}
                    className={`flex-1 items-center rounded-lg py-2 ${
                      recurringFrequency === freq
                        ? "bg-amber-600 dark:bg-amber-500"
                        : "bg-stone-100 dark:bg-stone-800"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium capitalize ${
                        recurringFrequency === freq
                          ? "text-white"
                          : "text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {freq}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {error && (
              <Text className="text-sm text-red-600 dark:text-red-400">
                {error}
              </Text>
            )}

            <Button
              onPress={handleSubmit}
              loading={createExpense.isPending}
              disabled={!description.trim() || parsedCents <= 0}
            >
              Add expense
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
