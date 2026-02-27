import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ChevronLeft, Check, ChevronRight, RefreshCw } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../../lib/auth";
import { useGroupDetail, useCreateExpense } from "../../../../../lib/queries";
import { LoadingSpinner } from "../../../../../components/ui/LoadingSpinner";
import { Button } from "../../../../../components/ui/Button";
import {
  stripAmountFormatting,
  formatCents,
  splitAmount,
  formatDisplayName,
  UNKNOWN_USER,
} from "../../../../../lib/queries/shared";
import { extractMembers } from "./index";

type SplitType = "equal" | "percentage" | "custom";

const RECURRING_OPTIONS = [
  { value: "weekly" as const, label: "Weekly" },
  { value: "monthly" as const, label: "Monthly" },
  { value: "yearly" as const, label: "Yearly" },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
      {children}
    </Text>
  );
}

export default function SplitOptionsScreen() {
  const { id, amount, description, date } = useLocalSearchParams<{
    id: string;
    amount: string;
    description: string;
    date: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroupDetail(id!);
  const createExpense = useCreateExpense(id!);

  const members = useMemo(
    () => extractMembers(group as Record<string, unknown> | null),
    [group],
  );

  const parsedCents = useMemo(() => {
    const n = parseFloat(stripAmountFormatting(amount ?? "0"));
    return isNaN(n) || n <= 0 ? 0 : Math.round(n * 100);
  }, [amount]);

  // Form state — default to current user paid, all members split equally
  const [paidByIdOverride, setPaidByIdOverride] = useState<string | null>(null);
  const paidById = paidByIdOverride ?? user?.id ?? members[0]?.userId ?? "";

  const [participantIdsOverride, setParticipantIdsOverride] = useState<Set<string> | null>(null);
  const participantIds = participantIdsOverride ?? new Set(members.map((m) => m.userId));

  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");

  const splitDisplay = useMemo(() => {
    const ids = Array.from(participantIds);
    if (ids.length === 0 || parsedCents === 0 || splitType !== "equal") {
      return new Map<string, number>();
    }
    const amounts = splitAmount(parsedCents, ids.length);
    return new Map(ids.map((uid, i) => [uid, amounts[i]!]));
  }, [participantIds, parsedCents, splitType]);

  const paidByName = useMemo(() => {
    if (paidById === user?.id) return "you";
    const m = members.find((mem) => mem.userId === paidById);
    return m ? formatDisplayName(m.displayName) : UNKNOWN_USER;
  }, [paidById, user?.id, members]);

  const splitSummary = useMemo(() => {
    const count = participantIds.size;
    const total = members.length;
    if (splitType === "equal" && count === total) return "split equally";
    if (splitType === "equal") return `split equally among ${count}`;
    if (splitType === "percentage") return "split by %";
    return "split with custom amounts";
  }, [splitType, participantIds.size, members.length]);

  const toggleParticipant = (userId: string) => {
    setParticipantIdsOverride((prev) => {
      const current = prev ?? new Set(members.map((m) => m.userId));
      const next = new Set(current);
      if (next.has(userId)) {
        if (next.size > 1) next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
    void Haptics.selectionAsync();
  };

  const handleSubmit = async () => {
    if (participantIds.size === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await createExpense.mutateAsync({
      groupId: id!,
      description: description ?? "",
      amountCents: parsedCents,
      date: date ?? new Date().toISOString().split("T")[0]!,
      paidById,
      participantIds: Array.from(participantIds),
      members,
      splitType: "equal",
      recurringFrequency: recurringEnabled ? recurringFrequency : undefined,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate(`/(app)/groups/${id}`);
  };

  const handleContinue = () => {
    if (participantIds.size === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: `/(app)/groups/${id}/add-expense/advanced` as const,
      params: {
        amount: amount ?? "",
        description: description ?? "",
        date: date ?? "",
        paidById,
        participantIds: JSON.stringify(Array.from(participantIds)),
        splitType,
        recurring: recurringEnabled ? recurringFrequency : "",
      },
    });
  };

  const isEqualSplit = splitType === "equal";

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
          Split options
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
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

          {/* ── Paid by ── */}
          <Animated.View
            entering={FadeInDown.duration(240).delay(40)}
            className="mb-7"
          >
            <SectionLabel>Paid by</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {members.map((m) => {
                const isSelected = paidById === m.userId;
                const isMe = m.userId === user?.id;
                return (
                  <Pressable
                    key={m.userId}
                    onPress={() => {
                      setPaidByIdOverride(m.userId);
                      void Haptics.selectionAsync();
                    }}
                    className={`flex-row items-center gap-2 rounded-full px-4 py-2.5 ${
                      isSelected
                        ? "bg-amber-600 dark:bg-amber-500"
                        : "bg-stone-100 active:opacity-80 dark:bg-stone-800"
                    }`}
                  >
                    {m.emoji && (
                      <Text className="text-sm">{m.emoji}</Text>
                    )}
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected
                          ? "text-white"
                          : "text-stone-700 dark:text-stone-300"
                      }`}
                    >
                      {isMe ? "You" : formatDisplayName(m.displayName)}
                    </Text>
                    {isSelected && (
                      <Check size={12} color="#fff" strokeWidth={3} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* ── Split type segmented control ── */}
          <Animated.View
            entering={FadeInDown.duration(240).delay(70)}
            className="mb-7"
          >
            <SectionLabel>Split type</SectionLabel>
            <View className="flex-row rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
              {(["equal", "custom", "percentage"] as const).map((type) => {
                const isActive = splitType === type;
                const label =
                  type === "equal" ? "Equal" : type === "custom" ? "Custom $" : "%";
                return (
                  <Pressable
                    key={type}
                    onPress={() => {
                      setSplitType(type);
                      void Haptics.selectionAsync();
                    }}
                    className={`flex-1 items-center rounded-lg py-2.5 ${
                      isActive ? "bg-white shadow-sm dark:bg-stone-700" : ""
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        isActive
                          ? "text-stone-900 dark:text-white"
                          : "text-stone-500 dark:text-stone-400"
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Split between ── */}
          <Animated.View
            entering={FadeInDown.duration(240).delay(100)}
            className="mb-5"
          >
            <SectionLabel>Split between</SectionLabel>
            <View className="overflow-hidden rounded-2xl border border-stone-100 dark:border-stone-800">
              {members.map((m, idx) => {
                const isSelected = participantIds.has(m.userId);
                const isLast = idx === members.length - 1;
                const perPersonAmount = splitDisplay.get(m.userId);
                const isMe = m.userId === user?.id;

                return (
                  <Pressable
                    key={m.userId}
                    onPress={() => toggleParticipant(m.userId)}
                    className={`flex-row items-center px-4 py-3.5 ${
                      isSelected
                        ? "bg-amber-50 dark:bg-amber-900/15"
                        : "bg-white dark:bg-stone-900"
                    } ${!isLast ? "border-b border-stone-100 dark:border-stone-800" : ""}`}
                  >
                    {m.emoji && (
                      <Text className="mr-3 text-xl">{m.emoji}</Text>
                    )}
                    <Text
                      className="flex-1 text-[15px] font-medium text-stone-900 dark:text-stone-100"
                      numberOfLines={1}
                    >
                      {isMe ? "You" : formatDisplayName(m.displayName)}
                    </Text>

                    {/* Per-person share (equal split only) */}
                    {isSelected &&
                      parsedCents > 0 &&
                      isEqualSplit &&
                      perPersonAmount !== undefined && (
                        <Text className="mr-3.5 text-sm font-medium text-amber-600/80 dark:text-amber-400/70">
                          {formatCents(perPersonAmount)}
                        </Text>
                      )}

                    {/* Amber checkbox */}
                    <View
                      className={`h-6 w-6 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-amber-500"
                          : "border-2 border-stone-300 dark:border-stone-600"
                      }`}
                    >
                      {isSelected && (
                        <Check size={13} color="#fff" strokeWidth={3} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Non-equal split hint → navigate to Screen 3 ── */}
          {!isEqualSplit && (
            <Animated.View entering={FadeIn.duration(200)} className="mb-5">
              <Pressable
                onPress={handleContinue}
                className="flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 active:opacity-80 dark:border-amber-800/60 dark:bg-amber-900/20"
              >
                <Text className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Set {splitType === "percentage" ? "percentages" : "amounts"} per person
                </Text>
                <ChevronRight size={16} color="#d97706" strokeWidth={2} />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Summary ── */}
          {paidById && (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="mb-5 rounded-xl bg-stone-50 px-4 py-3 dark:bg-stone-800/50"
            >
              <Text className="text-center text-xs text-stone-400 dark:text-stone-500">
                Paid by {paidByName}, {splitSummary}
              </Text>
            </Animated.View>
          )}

          {/* ── Recurring ── */}
          <Animated.View
            entering={FadeInDown.duration(240).delay(120)}
            className="mb-2"
          >
            <Pressable
              onPress={() => {
                setRecurringEnabled((v) => !v);
                void Haptics.selectionAsync();
              }}
              className="flex-row items-center gap-3 py-1"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-lg ${
                  recurringEnabled
                    ? "bg-amber-500"
                    : "border-2 border-stone-300 dark:border-stone-600"
                }`}
              >
                {recurringEnabled && (
                  <Check size={13} color="#fff" strokeWidth={3} />
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <RefreshCw size={14} color="#a8a29e" strokeWidth={2} />
                <Text className="text-[14px] font-medium text-stone-700 dark:text-stone-300">
                  Repeat this expense
                </Text>
              </View>
            </Pressable>

            {recurringEnabled && (
              <Animated.View
                entering={FadeIn.duration(180)}
                className="mt-3 flex-row rounded-xl bg-stone-100 p-1 dark:bg-stone-800"
              >
                {RECURRING_OPTIONS.map((opt) => {
                  const isActive = recurringFrequency === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setRecurringFrequency(opt.value);
                        void Haptics.selectionAsync();
                      }}
                      className={`flex-1 items-center rounded-lg py-2.5 ${
                        isActive ? "bg-white shadow-sm dark:bg-stone-700" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isActive
                            ? "text-stone-900 dark:text-white"
                            : "text-stone-500 dark:text-stone-400"
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}
          </Animated.View>

        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View className="border-t border-stone-100 bg-[#faf9f7] px-5 pb-6 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]">
        {isEqualSplit ? (
          <Button
            variant="primary"
            size="lg"
            onPress={() => void handleSubmit()}
            loading={createExpense.isPending}
            disabled={participantIds.size === 0 || createExpense.isPending}
          >
            Add expense
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onPress={handleContinue}
            disabled={participantIds.size === 0}
          >
            Continue
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
