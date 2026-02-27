import { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import Animated, { FadeIn } from "react-native-reanimated";
import { X, ChevronRight, Calendar, SlidersHorizontal } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/auth";
import { useGroupDetail, useCreateExpense } from "../../../../lib/queries";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import { Button } from "../../../../components/ui/Button";
import {
  filterAmountInput,
  formatAmountDisplay,
  stripAmountFormatting,
  formatCents,
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  MAX_EXPENSE_DESCRIPTION,
  toLocalDateString,
  MEMBER_EMOJIS,
  UNKNOWN_USER,
} from "../../../../lib/queries/shared";
import type { Member } from "../../../../lib/types";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatShortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Extract members from group detail response. */
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
  const { data: group, isLoading } = useGroupDetail(id!);
  const createExpense = useCreateExpense(id!);

  const members = useMemo(
    () => extractMembers(group as Record<string, unknown> | null),
    [group],
  );

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === "ios");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);

  const amountRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);

  // Focus amount input after the screen animates in — no autoFocus prop
  // (autoFocus can re-steal focus from sibling inputs after layout changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      amountRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const parsedCents = useMemo(() => {
    const n = parseFloat(stripAmountFormatting(amount));
    return isNaN(n) || n <= 0 ? 0 : Math.round(n * 100);
  }, [amount]);

  const canSubmit = parsedCents > 0 && description.trim().length > 0;

  const validate = (): boolean => {
    let valid = true;
    if (!amount.trim() || parsedCents <= 0) {
      setAmountError("Enter an amount");
      valid = false;
    } else if (parsedCents > MAX_AMOUNT_CENTS) {
      setAmountError(`Max $${MAX_AMOUNT_DOLLARS.toLocaleString()}`);
      valid = false;
    }
    if (!description.trim()) {
      setDescError("Add a description");
      valid = false;
    }
    return valid;
  };

  const handleNavigateToSplit = () => {
    if (!validate()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: `/(app)/groups/${id}/add-expense/split` as const,
      params: {
        amount: formatAmountDisplay(amount),
        description: description.trim(),
        date: toLocalDateString(date),
      },
    });
  };

  const handleQuickSubmit = async () => {
    if (!validate()) return;
    if (members.length === 0) return;

    const paidById = user?.id ?? members[0]!.userId;
    await createExpense.mutateAsync({
      groupId: id!,
      description: description.trim(),
      amountCents: parsedCents,
      date: toLocalDateString(date),
      paidById,
      participantIds: members.map((m) => m.userId),
      members,
      splitType: "equal",
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* ── Header ── */}
        <View className="flex-row items-center justify-between px-5 pb-4 pt-3">
          <View style={{ width: 36 }} />
          <Text className="text-lg font-bold text-stone-900 dark:text-white">
            Add an expense
          </Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-full bg-stone-100 active:opacity-70 dark:bg-stone-800"
          >
            <X size={16} color="#78716c" strokeWidth={2.5} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View className="px-6">

            {/* ── Amount hero ── */}
            <View className="mb-10 items-center pt-6">
              <Text className="mb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">
                How much?
              </Text>
              <View className="flex-row items-baseline">
                <Text
                  className="text-5xl font-light text-stone-300 dark:text-stone-600"
                  style={{ lineHeight: 64 }}
                >
                  $
                </Text>
                <TextInput
                  ref={amountRef}
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(filterAmountInput(text));
                    setAmountError(null);
                  }}
                  onBlur={() => {
                    const n = parseFloat(stripAmountFormatting(amount));
                    if (amount.trim() && !isNaN(n) && n > 0) {
                      setAmount(formatAmountDisplay(amount));
                      setAmountError(null);
                    }
                  }}
                  onSubmitEditing={() => descRef.current?.focus()}
                  returnKeyType="next"
                  placeholder="0.00"
                  placeholderTextColor="#d6d3d1"
                  keyboardType="decimal-pad"
                  className="min-w-[80px] text-center text-6xl font-bold tracking-tight text-stone-900 dark:text-white"
                  style={{ lineHeight: 72 }}
                />
              </View>
              {amountError && (
                <Animated.Text
                  entering={FadeIn.duration(200)}
                  className="mt-2 text-xs font-medium text-rose-500"
                >
                  {amountError}
                </Animated.Text>
              )}
            </View>

            {/* ── Description — underline style ── */}
            <View className="mb-8">
              <View
                className="border-b-2 pb-2"
                style={{
                  borderColor: descError ? "#f43f5e" : "#e7e5e4",
                }}
              >
                <TextInput
                  ref={descRef}
                  value={description}
                  onChangeText={(t) => {
                    setDescription(t.slice(0, MAX_EXPENSE_DESCRIPTION));
                    setDescError(null);
                  }}
                  placeholder="What's it for?"
                  placeholderTextColor="#a8a29e"
                  returnKeyType="done"
                  onSubmitEditing={handleNavigateToSplit}
                  className="text-2xl font-semibold text-stone-900 dark:text-white"
                />
              </View>
              {descError && (
                <Animated.Text
                  entering={FadeIn.duration(200)}
                  className="mt-1.5 text-xs font-medium text-rose-500"
                >
                  {descError}
                </Animated.Text>
              )}
            </View>

            {/* ── Date ── */}
            <View className="mb-8">
              <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
                Date
              </Text>
              {Platform.OS === "ios" && showDatePicker && (
                <View className="flex-row">
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="compact"
                    onChange={(_, d) => {
                      if (d) setDate(d);
                    }}
                  />
                </View>
              )}
              {Platform.OS === "android" && (
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="flex-row items-center gap-2.5 self-start rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 active:opacity-75 dark:border-stone-700 dark:bg-stone-900"
                >
                  <Calendar size={14} color="#a8a29e" />
                  <Text className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {formatShortDate(date)}
                  </Text>
                </Pressable>
              )}
              {Platform.OS === "android" && showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setDate(d);
                  }}
                />
              )}
            </View>

            {/* ── Split options shortcut row ── */}
            <Pressable
              onPress={handleNavigateToSplit}
              className="flex-row items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3.5 active:opacity-80 dark:border-stone-800 dark:bg-stone-900"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <SlidersHorizontal size={16} color="#d97706" strokeWidth={2} />
                </View>
                <View>
                  <Text className="text-[14px] font-semibold text-stone-800 dark:text-stone-200">
                    Split options
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-stone-400 dark:text-stone-500">
                    Paid by you · split equally
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color="#a8a29e" strokeWidth={2} />
            </Pressable>

          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View className="border-t border-stone-100 bg-[#faf9f7] px-5 pb-6 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]">
          {parsedCents > 0 && description.trim() && (
            <Animated.Text
              entering={FadeIn.duration(200)}
              className="mb-2 text-center text-[13px] text-stone-400 dark:text-stone-500"
            >
              {formatCents(parsedCents)} · paid by you, split equally
            </Animated.Text>
          )}
          <Button
            variant="primary"
            size="lg"
            onPress={() => void handleQuickSubmit()}
            loading={createExpense.isPending}
            disabled={!canSubmit || createExpense.isPending}
          >
            Add expense
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
