import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Check, Calendar, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import {
  MAX_EXPENSE_DESCRIPTION,
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  filterAmountInput,
  formatAmountDisplay,
  stripAmountFormatting,
  splitAmount,
  percentagesToCents,
  formatCents,
  UNKNOWN_USER,
  formatDisplayName,
  toLocalDateString,
} from "../lib/queries/shared";
import type { Member } from "../lib/types";

export interface ExpenseFormData {
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD local time
  paidById: string;
  participantIds: string[];
  splitType: "equal" | "custom"; // percentage normalized to custom
  splitAmounts?: number[]; // defined when custom
  recurringFrequency?: "weekly" | "monthly" | "yearly";
}

export interface ExpenseFormProps {
  members: Member[];
  currentUserId: string;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  isLoading: boolean;
  submitLabel?: string;
  showRecurring?: boolean;
  initialData?: {
    description: string;
    amountCents: number;
    date: string; // YYYY-MM-DD
    paidById: string;
    participantIds: string[];
    splitType: "equal" | "custom";
    splitAmounts?: number[]; // parallel to participantIds, only when custom
  };
}

type SplitType = "equal" | "percentage" | "custom";
type Step = 0 | 1 | 2;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatShortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Generate human-readable split summary. */
function getSplitSummary(
  paidById: string,
  currentUserId: string,
  members: Member[],
  splitType: SplitType,
  participantCount: number,
  totalMembers: number,
): string {
  const paidByMe = paidById === currentUserId;
  const paidByMember = members.find((m) => m.userId === paidById);
  const paidByName = paidByMe
    ? "you"
    : formatDisplayName(paidByMember?.displayName ?? UNKNOWN_USER);

  let splitText: string;
  if (splitType === "equal" && participantCount === totalMembers) {
    splitText = "split equally";
  } else if (splitType === "equal") {
    splitText = `split equally among ${participantCount}`;
  } else if (splitType === "percentage") {
    splitText = "split by percentage";
  } else {
    splitText = "split with custom amounts";
  }

  return `Paid by ${paidByName}, ${splitText}`;
}

// ─── Step indicator ───────────────────────────────────────────

function StepDots({ current, total }: { current: Step; total: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-3">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          className={`rounded-full transition-all ${
            i === current
              ? "h-1.5 w-5 bg-amber-600 dark:bg-amber-500"
              : i < current
                ? "h-1.5 w-1.5 bg-amber-400/60 dark:bg-amber-600/60"
                : "h-1.5 w-1.5 bg-stone-200 dark:bg-stone-700"
          }`}
        />
      ))}
    </View>
  );
}

// ─── Section label ────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
      {children}
    </Text>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ExpenseForm({
  members,
  currentUserId,
  onSubmit,
  isLoading,
  submitLabel = "Add expense",
  showRecurring = true,
  initialData,
}: ExpenseFormProps) {
  const insets = useSafeAreaInsets();

  // Step navigation
  const [step, setStep] = useState<Step>(0);

  // ── Build initial customAmounts from initialData ──
  const initialCustomAmounts = useMemo(() => {
    if (
      initialData?.splitType === "custom" &&
      initialData.splitAmounts &&
      initialData.splitAmounts.length === initialData.participantIds.length
    ) {
      const map = new Map<string, string>();
      initialData.participantIds.forEach((uid, i) => {
        const cents = initialData.splitAmounts![i];
        if (cents !== undefined) {
          map.set(uid, formatAmountDisplay(String(cents / 100)));
        }
      });
      return map;
    }
    return new Map<string, string>();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form state ──
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [amount, setAmount] = useState(
    initialData?.amountCents ? formatAmountDisplay(String(initialData.amountCents / 100)) : "",
  );
  const [date, setDate] = useState(
    initialData?.date ? new Date(initialData.date + "T12:00:00") : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === "ios");
  const [paidById, setPaidById] = useState<string | null>(initialData?.paidById ?? null);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    initialData?.participantIds
      ? new Set(initialData.participantIds)
      : new Set<string>(),
  );
  const [splitType, setSplitType] = useState<SplitType>(
    initialData?.splitType === "custom" ? "custom" : "equal",
  );
  const [customAmounts, setCustomAmounts] = useState<Map<string, string>>(initialCustomAmounts);
  const [percentages, setPercentages] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Refs
  const initialized = useRef(false);
  const amountInputRef = useRef<import("react-native").TextInput>(null);

  // Focus amount input on mount (using ref instead of autoFocus prop to avoid
  // focus theft when sibling inputs are tapped after layout animations)
  useEffect(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // Initialize defaults once (only when no initialData)
  if (members.length > 0 && !initialized.current) {
    initialized.current = true;
    if (!paidById) setPaidById(currentUserId ?? members[0]!.userId);
    if (participantIds.size === 0)
      setParticipantIds(new Set(members.map((m) => m.userId)));
  }

  // ─── Derived values ───

  const parsedCents = useMemo(() => {
    const num = parseFloat(stripAmountFormatting(amount));
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }, [amount]);

  const splitDisplay = useMemo(() => {
    const ids = Array.from(participantIds);
    if (ids.length === 0 || parsedCents === 0) return new Map<string, number>();

    if (splitType === "equal") {
      const amounts = splitAmount(parsedCents, ids.length);
      return new Map(ids.map((uid, i) => [uid, amounts[i]!]));
    }
    if (splitType === "percentage") {
      return percentagesToCents(percentages, ids, parsedCents);
    }
    return new Map(
      ids.map((uid) => [
        uid,
        Math.round(parseFloat(stripAmountFormatting(customAmounts.get(uid) ?? "0")) * 100),
      ]),
    );
  }, [splitType, participantIds, parsedCents, percentages, customAmounts]);

  const customTotal = useMemo(() => {
    let total = 0;
    for (const v of splitDisplay.values()) total += v;
    return total;
  }, [splitDisplay]);

  const percentageTotal = useMemo(() => {
    let total = 0;
    for (const uid of participantIds) {
      total += parseInt(percentages.get(uid) ?? "0", 10) || 0;
    }
    return total;
  }, [participantIds, percentages]);

  const totalSteps = splitType === "equal" ? 2 : 3;

  // ─── Navigation ───

  const goNext = useCallback(() => {
    setError(null);

    // Validate step 0
    if (step === 0) {
      if (!amount.trim() || parsedCents <= 0) {
        setAmountError("Enter an amount");
        return;
      }
      if (parsedCents > MAX_AMOUNT_CENTS) {
        setAmountError(`Max $${MAX_AMOUNT_DOLLARS.toLocaleString()}`);
        return;
      }
      if (!description.trim()) {
        setError("Add a description");
        return;
      }
    }

    // Validate step 1 — if equal split, this is submit
    if (step === 1 && splitType === "equal") {
      if (participantIds.size === 0) {
        setError("Select at least one person");
        return;
      }
      void handleSubmit();
      return;
    }

    // Validate step 1 going to step 2
    if (step === 1) {
      if (participantIds.size === 0) {
        setError("Select at least one person");
        return;
      }
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(s + 1, 2) as Step);
  }, [step, amount, parsedCents, description, splitType, participantIds]);

  const goBack = useCallback(() => {
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.max(s - 1, 0) as Step);
  }, []);

  // ─── Form handlers ───

  const handleAmountBlur = () => {
    const num = parseFloat(stripAmountFormatting(amount));
    if (amount.trim() && !isNaN(num) && num > 0) {
      if (Math.round(num * 100) > MAX_AMOUNT_CENTS) {
        setAmountError(`Max $${MAX_AMOUNT_DOLLARS.toLocaleString()}`);
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
      setAmountError("Enter a valid amount.");
      return;
    }
    if (parsedCents > MAX_AMOUNT_CENTS) {
      setAmountError(`Max $${MAX_AMOUNT_DOLLARS.toLocaleString()}`);
      return;
    }
    if (participantIds.size === 0) {
      setError("At least one participant is required.");
      return;
    }

    const ids = Array.from(participantIds);
    let normalizedSplitAmounts: number[] | undefined;
    let normalizedSplitType: "equal" | "custom" = "equal";

    if (splitType === "custom" || splitType === "percentage") {
      normalizedSplitAmounts = ids.map((uid) => splitDisplay.get(uid) ?? 0);
      const sum = normalizedSplitAmounts.reduce((a, b) => a + b, 0);
      if (sum !== parsedCents) {
        setError(
          `Split amounts must equal the total (${formatCents(sum)} vs ${formatCents(parsedCents)}).`,
        );
        return;
      }
      normalizedSplitType = "custom";
    }

    await onSubmit({
      description: description.trim(),
      amountCents: parsedCents,
      date: toLocalDateString(date),
      paidById: paidById!,
      participantIds: ids,
      splitType: normalizedSplitType,
      splitAmounts: normalizedSplitAmounts,
    });
  };

  // ─── Step 0: Amount + Description ───────────────────────────

  const renderQuickEntry = () => (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View className="flex-1 px-6">
        {/* ── Amount hero ── */}
        <View className="mb-10 items-center pt-10">
          <Text className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
            How much?
          </Text>

          {/* Dollar sign + input inline */}
          <View className="flex-row items-baseline">
            <Text
              className="pb-1 text-5xl font-light text-stone-300 dark:text-stone-600"
              style={{ lineHeight: 64 }}
            >
              $
            </Text>
            <TextInput
              ref={amountInputRef}
              className="min-w-[80px] text-center text-6xl font-bold tracking-tight text-stone-900 dark:text-white"
              style={{ lineHeight: 72 }}
              placeholder="0.00"
              placeholderTextColor="#d6d3d1"
              value={amount}
              onChangeText={(text) => {
                setAmount(filterAmountInput(text));
                setAmountError(null);
              }}
              onBlur={handleAmountBlur}
              keyboardType="decimal-pad"
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

        {/* ── Description ── */}
        <View className="mb-5">
          <SectionLabel>What's it for?</SectionLabel>
          <Input
            placeholder="Dinner, groceries, rent..."
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              setError(null);
            }}
            maxLength={MAX_EXPENSE_DESCRIPTION}
            returnKeyType="next"
            onSubmitEditing={goNext}
          />
        </View>

        {/* ── Date ── */}
        <View className="mb-6">
          <SectionLabel>Date</SectionLabel>
          {/* iOS: inline compact date picker */}
          {Platform.OS === "ios" && showDatePicker && (
            <View className="flex-row">
              <DateTimePicker
                value={date}
                mode="date"
                display="compact"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            </View>
          )}
          {/* Android: pressable trigger */}
          {Platform.OS === "android" && (
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center gap-2.5 self-start rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 dark:border-stone-700 dark:bg-stone-900"
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
              onChange={(_event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );

  // ─── Step 1: Split options ────────────────────────────────────

  const renderSplitOptions = () => (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="px-5">
        {/* Summary pill */}
        {parsedCents > 0 && (
          <Animated.View
            entering={FadeIn.duration(220)}
            className="mb-6 items-center pt-4"
          >
            <View className="flex-row items-center gap-2 rounded-full bg-amber-50 px-4 py-2 dark:bg-amber-900/20">
              <Text className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {formatCents(parsedCents)}
              </Text>
              <View className="h-3 w-px bg-amber-300/60 dark:bg-amber-700/60" />
              <Text className="max-w-[160px] text-sm text-amber-600/80 dark:text-amber-400/80" numberOfLines={1}>
                {description || "Expense"}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Paid by */}
        <Animated.View
          entering={FadeInDown.duration(260).delay(40)}
          className="mb-7"
        >
          <SectionLabel>Paid by</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {members.map((m) => {
              const isSelected = paidById === m.userId;
              return (
                <Pressable
                  key={m.userId}
                  onPress={() => {
                    setPaidById(m.userId);
                    void Haptics.selectionAsync();
                  }}
                  className={`flex-row items-center gap-2 rounded-full px-4 py-2.5 ${
                    isSelected
                      ? "bg-amber-600 dark:bg-amber-500"
                      : "bg-stone-100 dark:bg-stone-800"
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
                    {m.userId === currentUserId
                      ? "You"
                      : formatDisplayName(m.displayName)}
                  </Text>
                  {isSelected && (
                    <Check size={12} color="#fff" strokeWidth={3} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Split type toggle */}
        <Animated.View
          entering={FadeInDown.duration(260).delay(70)}
          className="mb-7"
        >
          <SectionLabel>Split type</SectionLabel>
          <View className="flex-row overflow-hidden rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
            {(["equal", "custom", "percentage"] as const).map((type) => {
              const isActive = splitType === type;
              const label =
                type === "percentage"
                  ? "%"
                  : type.charAt(0).toUpperCase() + type.slice(1);
              return (
                <Pressable
                  key={type}
                  onPress={() => {
                    setSplitType(type);
                    void Haptics.selectionAsync();
                  }}
                  className={`flex-1 items-center rounded-lg py-2.5 ${
                    isActive
                      ? "bg-amber-600 shadow-sm dark:bg-amber-500"
                      : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isActive
                        ? "text-white"
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

        {/* Split between */}
        <Animated.View
          entering={FadeInDown.duration(260).delay(100)}
          className="mb-4"
        >
          <SectionLabel>Split between</SectionLabel>
          <View className="overflow-hidden rounded-2xl border border-stone-100 dark:border-stone-800">
            {members.map((m, idx) => {
              const isSelected = participantIds.has(m.userId);
              const isLast = idx === members.length - 1;
              const perPersonAmount = splitDisplay.get(m.userId);

              return (
                <Pressable
                  key={m.userId}
                  onPress={() => {
                    toggleParticipant(m.userId);
                    void Haptics.selectionAsync();
                  }}
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
                    {m.userId === currentUserId
                      ? "You"
                      : formatDisplayName(m.displayName)}
                  </Text>

                  {/* Per-person share for equal split */}
                  {isSelected && parsedCents > 0 && splitType === "equal" && perPersonAmount !== undefined && (
                    <Text className="mr-3.5 text-sm font-medium text-amber-600/80 dark:text-amber-400/70">
                      {formatCents(perPersonAmount)}
                    </Text>
                  )}

                  {/* Checkmark / unchecked box */}
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-md ${
                      isSelected
                        ? "bg-amber-600 dark:bg-amber-500"
                        : "border-2 border-stone-300 dark:border-stone-600"
                    }`}
                  >
                    {isSelected && (
                      <Check size={11} color="#fff" strokeWidth={3} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Split summary footer */}
        {paidById && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className="mt-1 rounded-xl bg-stone-50 px-4 py-3 dark:bg-stone-800/50"
          >
            <Text className="text-center text-xs text-stone-400 dark:text-stone-500">
              {getSplitSummary(
                paidById,
                currentUserId,
                members,
                splitType,
                participantIds.size,
                members.length,
              )}
            </Text>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );

  // ─── Step 2: Advanced split ───────────────────────────────────

  const renderAdvancedSplit = () => (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
    >
      <View className="px-5">
        {/* Header pill */}
        <Animated.View
          entering={FadeIn.duration(220)}
          className="mb-6 items-center pt-4"
        >
          <View className="flex-row items-center gap-2 rounded-full bg-amber-50 px-4 py-2 dark:bg-amber-900/20">
            <Text className="text-sm font-bold text-amber-700 dark:text-amber-400">
              {formatCents(parsedCents)}
            </Text>
            <View className="h-3 w-px bg-amber-300/60 dark:bg-amber-700/60" />
            <Text className="text-sm text-amber-600/80 dark:text-amber-400/80">
              {splitType === "percentage" ? "Split by %" : "Custom amounts"}
            </Text>
          </View>
        </Animated.View>

        {/* Per-person input rows */}
        <View className="mb-4 overflow-hidden rounded-2xl border border-stone-100 dark:border-stone-800">
          {Array.from(participantIds).map((uid, idx) => {
            const m = members.find((mem) => mem.userId === uid);
            const isCurrentUser = uid === currentUserId;
            const isLast = idx === Array.from(participantIds).length - 1;

            if (splitType === "custom") {
              return (
                <Animated.View
                  key={uid}
                  entering={FadeInDown.duration(240).delay(idx * 40)}
                  className={`flex-row items-center bg-white px-4 py-3.5 dark:bg-stone-900 ${
                    !isLast ? "border-b border-stone-100 dark:border-stone-800" : ""
                  }`}
                >
                  {m?.emoji && (
                    <Text className="mr-3 text-xl">{m.emoji}</Text>
                  )}
                  <Text
                    className="flex-1 text-[15px] font-medium text-stone-900 dark:text-stone-100"
                    numberOfLines={1}
                  >
                    {isCurrentUser
                      ? "You"
                      : formatDisplayName(m?.displayName ?? UNKNOWN_USER)}
                  </Text>
                  <View className="flex-row items-center gap-0.5">
                    <Text className="text-base text-stone-400 dark:text-stone-500">
                      $
                    </Text>
                    <TextInput
                      className="w-20 text-right text-base font-semibold text-stone-900 dark:text-white"
                      placeholder="0.00"
                      placeholderTextColor="#a8a29e"
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
                </Animated.View>
              );
            }

            // Percentage mode
            return (
              <Animated.View
                key={uid}
                entering={FadeInDown.duration(240).delay(idx * 40)}
                className={`flex-row items-center bg-white px-4 py-3.5 dark:bg-stone-900 ${
                  !isLast ? "border-b border-stone-100 dark:border-stone-800" : ""
                }`}
              >
                {m?.emoji && (
                  <Text className="mr-3 text-xl">{m.emoji}</Text>
                )}
                <View className="mr-3 flex-1">
                  <Text
                    className="text-[15px] font-medium text-stone-900 dark:text-stone-100"
                    numberOfLines={1}
                  >
                    {isCurrentUser
                      ? "You"
                      : formatDisplayName(m?.displayName ?? UNKNOWN_USER)}
                  </Text>
                  {parsedCents > 0 && (
                    <Text className="mt-0.5 text-xs font-medium text-amber-600/70 dark:text-amber-400/60">
                      {formatCents(splitDisplay.get(uid) ?? 0)}
                    </Text>
                  )}
                </View>
                <View className="flex-row items-center gap-0.5">
                  <TextInput
                    className="w-14 text-right text-base font-semibold text-stone-900 dark:text-white"
                    placeholder="0"
                    placeholderTextColor="#a8a29e"
                    value={percentages.get(uid) ?? ""}
                    onChangeText={(text) => {
                      setPercentages((prev) => {
                        const next = new Map(prev);
                        next.set(uid, text.replace(/[^0-9]/g, ""));
                        return next;
                      });
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text className="text-base font-medium text-stone-400 dark:text-stone-500">
                    %
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* Total validation bar */}
        {splitType === "custom" && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className={`flex-row items-center justify-between rounded-xl px-4 py-3 ${
              customTotal === parsedCents
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : "bg-rose-50 dark:bg-rose-900/20"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                customTotal === parsedCents
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              Total
            </Text>
            <Text
              className={`text-sm font-semibold ${
                customTotal === parsedCents
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              {formatCents(customTotal)} / {formatCents(parsedCents)}
              {customTotal === parsedCents ? "  \u2713" : ""}
            </Text>
          </Animated.View>
        )}

        {splitType === "percentage" && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className={`flex-row items-center justify-between rounded-xl px-4 py-3 ${
              percentageTotal === 100
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : "bg-rose-50 dark:bg-rose-900/20"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                percentageTotal === 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              Total
            </Text>
            <Text
              className={`text-sm font-semibold ${
                percentageTotal === 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              {percentageTotal}% / 100%
              {percentageTotal === 100 ? "  \u2713" : ""}
            </Text>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );

  // ─── Render ──────────────────────────────────────────────────

  const isLastStep =
    (splitType === "equal" && step === 1) || step === 2;

  const canSubmit =
    description.trim().length > 0 &&
    parsedCents > 0 &&
    participantIds.size > 0 &&
    (splitType === "equal" ||
      (splitType === "custom" && customTotal === parsedCents) ||
      (splitType === "percentage" && percentageTotal === 100));

  // Next button label hint on step 0
  const nextLabel =
    step === 0 ? (
      <View className="flex-row items-center gap-1.5">
        <Text className="text-sm font-semibold text-white">Next</Text>
        <ChevronRight size={14} color="#fff" strokeWidth={2.5} />
      </View>
    ) : undefined;

  return (
    <View style={{ flex: 1 }}>
      {/* Step dots */}
      <StepDots current={step} total={totalSteps} />

      {/* Step content */}
      <View className="flex-1">
        {step === 0 && renderQuickEntry()}
        {step === 1 && renderSplitOptions()}
        {step === 2 && renderAdvancedSplit()}
      </View>

      {/* Inline error */}
      {error && (
        <Animated.View
          entering={FadeIn.duration(200)}
          className="px-5 pb-2"
        >
          <Text className="text-center text-xs font-medium text-rose-500 dark:text-rose-400">
            {error}
          </Text>
        </Animated.View>
      )}

      {/* Bottom action bar */}
      <View
        style={{ paddingBottom: insets.bottom + 8 }}
        className="border-t border-stone-100 bg-[#faf9f7] px-5 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]"
      >
        <View className="flex-row gap-3">
          {step > 0 && (
            <Button
              variant="secondary"
              onPress={goBack}
              className="flex-1"
            >
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button
              onPress={() => void handleSubmit()}
              loading={isLoading}
              disabled={!canSubmit}
              className="flex-[2]"
            >
              {submitLabel}
            </Button>
          ) : (
            <Button
              onPress={goNext}
              className={step > 0 ? "flex-[2]" : "flex-1"}
            >
              {nextLabel ?? "Next"}
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}
