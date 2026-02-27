import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useGroupDetail, useCreateExpense } from "../../../../../lib/queries";
import { LoadingSpinner } from "../../../../../components/ui/LoadingSpinner";
import { Button } from "../../../../../components/ui/Button";
import {
  stripAmountFormatting,
  filterAmountInput,
  formatAmountDisplay,
  formatCents,
  splitAmount,
  formatDisplayName,
  UNKNOWN_USER,
} from "../../../../../lib/queries/shared";
import { extractMembers } from "./index";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
      {children}
    </Text>
  );
}

export default function AdvancedSplitScreen() {
  const { id, amount, description, date, paidById, participantIds: participantIdsParam, splitType, recurring } =
    useLocalSearchParams<{
      id: string;
      amount: string;
      description: string;
      date: string;
      paidById: string;
      participantIds: string;
      splitType: string;
      recurring: string;
    }>();
  const router = useRouter();
  const { data: group, isLoading } = useGroupDetail(id!);
  const createExpense = useCreateExpense(id!);

  const members = useMemo(
    () => extractMembers(group as Record<string, unknown> | null),
    [group],
  );

  const participantIds = useMemo<string[]>(() => {
    try {
      return JSON.parse(participantIdsParam ?? "[]") as string[];
    } catch {
      return [];
    }
  }, [participantIdsParam]);

  const isPercentage = splitType === "percentage";

  const parsedCents = useMemo(() => {
    const n = parseFloat(stripAmountFormatting(amount ?? "0"));
    return isNaN(n) || n <= 0 ? 0 : Math.round(n * 100);
  }, [amount]);

  // Initialize custom amounts with equal split as a helpful default
  const [customAmounts, setCustomAmounts] = useState<Map<string, string>>(() => {
    if (isPercentage) return new Map();
    const evenAmounts = splitAmount(parsedCents, participantIds.length);
    return new Map(
      participantIds.map((uid, i) =>
        [uid, formatAmountDisplay(String(evenAmounts[i]! / 100))]
      ),
    );
  });

  const [percentages, setPercentages] = useState<Map<string, string>>(() => {
    if (!isPercentage) return new Map();
    // Initialize with equal percentages
    const count = participantIds.length;
    if (count === 0) return new Map();
    const basePercent = Math.floor(100 / count);
    const remainder = 100 - basePercent * count;
    return new Map(
      participantIds.map((uid, i) =>
        [uid, String(basePercent + (i === 0 ? remainder : 0))]
      ),
    );
  });

  const customTotal = useMemo(() => {
    let total = 0;
    for (const uid of participantIds) {
      const v = parseFloat(stripAmountFormatting(customAmounts.get(uid) ?? "0"));
      total += isNaN(v) ? 0 : Math.round(v * 100);
    }
    return total;
  }, [customAmounts, participantIds]);

  const percentageTotal = useMemo(() => {
    let total = 0;
    for (const uid of participantIds) {
      total += parseInt(percentages.get(uid) ?? "0", 10) || 0;
    }
    return total;
  }, [percentages, participantIds]);

  const splitDisplay = useMemo(() => {
    if (!isPercentage) return new Map<string, number>();
    const result = new Map<string, number>();
    for (const uid of participantIds) {
      const pct = parseInt(percentages.get(uid) ?? "0", 10) || 0;
      result.set(uid, Math.round((pct / 100) * parsedCents));
    }
    return result;
  }, [isPercentage, percentages, participantIds, parsedCents]);

  const isValid = isPercentage ? percentageTotal === 100 : customTotal === parsedCents;

  const handleSubmit = async () => {
    if (!isValid) return;

    const splitAmountsArr = isPercentage
      ? participantIds.map((uid) => splitDisplay.get(uid) ?? 0)
      : participantIds.map((uid) => {
          const v = parseFloat(stripAmountFormatting(customAmounts.get(uid) ?? "0"));
          return isNaN(v) ? 0 : Math.round(v * 100);
        });

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await createExpense.mutateAsync({
      groupId: id!,
      description: description ?? "",
      amountCents: parsedCents,
      date: date ?? new Date().toISOString().split("T")[0]!,
      paidById: paidById ?? "",
      participantIds,
      members,
      splitType: "custom",
      splitAmounts: splitAmountsArr,
      recurringFrequency:
        recurring && recurring !== ""
          ? (recurring as "weekly" | "monthly" | "yearly")
          : undefined,
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate(`/(app)/groups/${id}`);
  };

  if (isLoading && members.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]"
      edges={["top", "left", "right"]}
    >
      {/* ── Header ── */}
      <View className="flex-row items-center justify-between px-4 pb-4 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="flex-row items-center gap-0.5 active:opacity-70"
        >
          <ChevronLeft size={20} color="#78716c" strokeWidth={2} />
          <Text className="text-sm font-medium text-stone-500 dark:text-stone-400">Back</Text>
        </Pressable>
        <Text className="text-lg font-bold text-stone-900 dark:text-white">
          {isPercentage ? "Split by %" : "Custom split"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">

          {/* ── Amount + description summary pill ── */}
          {parsedCents > 0 && (
            <Animated.View
              entering={FadeIn.duration(220)}
              className="mb-6 items-center pt-2"
            >
              <View className="flex-row items-center gap-2 rounded-full bg-amber-50 px-4 py-2 dark:bg-amber-900/20">
                <Text className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {formatCents(parsedCents)}
                </Text>
                <View className="h-3 w-px bg-amber-300/60 dark:bg-amber-700/60" />
                <Text
                  className="max-w-[160px] text-sm text-amber-600/80 dark:text-amber-400/80"
                  numberOfLines={1}
                >
                  {description ?? "Expense"}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ── Per-person inputs ── */}
          <Animated.View
            entering={FadeInDown.duration(240).delay(40)}
            className="mb-4"
          >
            <SectionLabel>
              {isPercentage ? "Percentage per person" : "Amount per person"}
            </SectionLabel>
            <View className="overflow-hidden rounded-2xl border border-stone-100 dark:border-stone-800">
              {participantIds.map((uid, idx) => {
                const m = members.find((mem) => mem.userId === uid);
                const isLast = idx === participantIds.length - 1;
                const displayName = m
                  ? formatDisplayName(m.displayName)
                  : UNKNOWN_USER;

                return (
                  <Animated.View
                    key={uid}
                    entering={FadeInDown.duration(220).delay(idx * 40)}
                    className={`flex-row items-center bg-white px-4 py-3.5 dark:bg-stone-900 ${
                      !isLast ? "border-b border-stone-100 dark:border-stone-800" : ""
                    }`}
                  >
                    {m?.emoji && (
                      <Text className="mr-3 text-xl">{m.emoji}</Text>
                    )}
                    <View className="mr-3 min-w-0 flex-1">
                      <Text
                        className="text-[15px] font-medium text-stone-900 dark:text-stone-100"
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      {isPercentage && parsedCents > 0 && (
                        <Text className="mt-0.5 text-xs font-medium text-amber-600/70 dark:text-amber-400/60">
                          {formatCents(splitDisplay.get(uid) ?? 0)}
                        </Text>
                      )}
                    </View>

                    {/* Input */}
                    <View className="flex-row items-center gap-1">
                      {!isPercentage && (
                        <Text className="text-base text-stone-400 dark:text-stone-500">$</Text>
                      )}
                      <TextInput
                        value={
                          isPercentage
                            ? percentages.get(uid) ?? ""
                            : customAmounts.get(uid) ?? ""
                        }
                        onChangeText={(text) => {
                          if (isPercentage) {
                            setPercentages((prev) => {
                              const next = new Map(prev);
                              next.set(uid, text.replace(/[^0-9]/g, "").slice(0, 3));
                              return next;
                            });
                          } else {
                            setCustomAmounts((prev) => {
                              const next = new Map(prev);
                              next.set(uid, filterAmountInput(text));
                              return next;
                            });
                          }
                        }}
                        onBlur={() => {
                          if (!isPercentage) {
                            setCustomAmounts((prev) => {
                              const next = new Map(prev);
                              const raw = next.get(uid) ?? "";
                              const n = parseFloat(stripAmountFormatting(raw));
                              if (!isNaN(n) && n >= 0) {
                                next.set(uid, formatAmountDisplay(raw));
                              }
                              return next;
                            });
                          }
                        }}
                        keyboardType={isPercentage ? "number-pad" : "decimal-pad"}
                        className={`text-right text-base font-semibold text-stone-900 dark:text-white ${
                          isPercentage ? "w-14" : "w-20"
                        }`}
                        placeholder={isPercentage ? "0" : "0.00"}
                        placeholderTextColor="#a8a29e"
                        maxLength={isPercentage ? 3 : undefined}
                      />
                      {isPercentage && (
                        <Text className="text-base font-medium text-stone-400 dark:text-stone-500">
                          %
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Total validation bar ── */}
          <Animated.View
            entering={FadeIn.duration(200)}
            className={`flex-row items-center justify-between rounded-xl px-4 py-3.5 ${
              isValid
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : "bg-rose-50 dark:bg-rose-900/20"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isValid
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              Total
            </Text>
            <Text
              className={`text-sm font-semibold ${
                isValid
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              {isPercentage
                ? `${percentageTotal}% / 100%${isValid ? "  ✓" : ""}`
                : `${formatCents(customTotal)} / ${formatCents(parsedCents)}${isValid ? "  ✓" : ""}`}
            </Text>
          </Animated.View>

        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View className="border-t border-stone-100 bg-[#faf9f7] px-5 pb-6 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]">
        <Button
          variant="primary"
          size="lg"
          onPress={() => void handleSubmit()}
          loading={createExpense.isPending}
          disabled={!isValid || createExpense.isPending}
        >
          Add expense
        </Button>
      </View>
    </SafeAreaView>
  );
}
