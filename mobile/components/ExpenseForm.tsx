import { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check } from "lucide-react-native";
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
  UNKNOWN_USER,
  MEMBER_EMOJIS,
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
}

type SplitType = "equal" | "percentage" | "custom";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatShortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function ExpenseForm({
  members,
  currentUserId,
  onSubmit,
  isLoading,
  submitLabel = "Add expense",
  showRecurring = true,
}: ExpenseFormProps) {
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === "ios");
  const [paidById, setPaidById] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customAmounts, setCustomAmounts] = useState<Map<string, string>>(new Map());
  const [percentages, setPercentages] = useState<Map<string, string>>(new Map());
  const [recurring, setRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Initialize defaults once when members become available
  if (members.length > 0 && !initialized.current) {
    initialized.current = true;
    if (!paidById) setPaidById(currentUserId ?? members[0]!.userId);
    if (participantIds.size === 0)
      setParticipantIds(new Set(members.map((m) => m.userId)));
  }

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

  const handleAmountBlur = () => {
    const num = parseFloat(stripAmountFormatting(amount));
    if (amount.trim() && !isNaN(num) && num > 0) {
      if (Math.round(num * 100) > MAX_AMOUNT_CENTS) {
        setAmountError(`Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`);
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
      setAmountError(`Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`);
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
        setError(`Split amounts must equal the total (${sum} vs ${parsedCents}).`);
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
      recurringFrequency: (showRecurring && recurring) ? recurringFrequency : undefined,
    });
  };

  const percentageTotal = useMemo(() => {
    let total = 0;
    for (const uid of participantIds) {
      total += parseInt(percentages.get(uid) ?? "0", 10) || 0;
    }
    return total;
  }, [participantIds, percentages]);

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount — prominent centered input */}
        <View className="mb-6 items-center py-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Amount
          </Text>
          <View className="flex-row items-baseline">
            <Text className="text-3xl font-bold text-stone-300 dark:text-stone-600">$</Text>
            <TextInput
              className="min-w-[80px] text-center text-4xl font-bold text-stone-900 dark:text-white"
              placeholder="0.00"
              placeholderTextColor="#d6d3d1"
              value={amount}
              onChangeText={(text) => {
                setAmount(filterAmountInput(text));
                setAmountError(null);
              }}
              onBlur={handleAmountBlur}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
          {amountError && (
            <Text className="mt-2 text-xs text-red-500">{amountError}</Text>
          )}
        </View>

        {/* Description */}
        <View className="mb-5">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Description
          </Text>
          <Input
            placeholder="What's this for?"
            value={description}
            onChangeText={setDescription}
            maxLength={MAX_EXPENSE_DESCRIPTION}
          />
        </View>

        {/* Date */}
        <View className="mb-5">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Date
          </Text>
          {Platform.OS === "android" && (
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 dark:border-stone-700 dark:bg-stone-900"
            >
              <Text className="text-base text-stone-900 dark:text-stone-100">
                {formatShortDate(date)}
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
        <View className="mb-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
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
                className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${
                  paidById === m.userId
                    ? "bg-amber-600 dark:bg-amber-500"
                    : "bg-stone-100 dark:bg-stone-800"
                }`}
              >
                <Text className="text-sm">{m.emoji}</Text>
                <Text
                  className={`text-xs font-medium ${
                    paidById === m.userId
                      ? "text-white"
                      : "text-stone-700 dark:text-stone-300"
                  }`}
                >
                  {formatDisplayName(m.displayName)}
                  {m.userId === currentUserId ? " (you)" : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Split type — segmented control */}
        <View className="mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Split type
          </Text>
          <View className="flex-row rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
            {(["equal", "custom", "percentage"] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setSplitType(type)}
                className={`flex-1 items-center rounded-md py-2 ${
                  splitType === type ? "bg-amber-600 shadow-sm dark:bg-amber-500" : ""
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    splitType === type ? "text-white" : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  {type === "percentage"
                    ? "%"
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Participants */}
        <View className="mb-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Split between
          </Text>
          <View className="gap-1.5">
            {members.map((m) => {
              const isSelected = participantIds.has(m.userId);
              return (
                <Pressable
                  key={m.userId}
                  onPress={() => toggleParticipant(m.userId)}
                  className={`flex-row items-center rounded-xl border px-3.5 py-3 ${
                    isSelected
                      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                      : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
                  }`}
                >
                  <Text className="mr-2.5 text-base">{m.emoji}</Text>
                  <Text
                    className="flex-1 text-sm font-medium text-stone-900 dark:text-stone-100"
                    numberOfLines={1}
                  >
                    {formatDisplayName(m.displayName)}
                    {m.userId === currentUserId ? " (you)" : ""}
                  </Text>

                  {/* Equal split amount display */}
                  {isSelected && parsedCents > 0 && splitType === "equal" && (
                    <Text className="mr-2.5 text-xs text-stone-400">
                      {formatAmountDisplay(String((splitDisplay.get(m.userId) ?? 0) / 100))}
                    </Text>
                  )}

                  {/* Checkmark */}
                  <View
                    className={`h-5 w-5 items-center justify-center rounded ${
                      isSelected
                        ? "bg-amber-600 dark:bg-amber-500"
                        : "border border-stone-300 dark:border-stone-600"
                    }`}
                  >
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Custom amounts */}
        {splitType === "custom" && (
          <View className="mb-5 gap-2.5">
            {Array.from(participantIds).map((uid) => {
              const m = members.find((mem) => mem.userId === uid);
              return (
                <View key={uid} className="flex-row items-center gap-2.5">
                  <Text className="text-sm">{m?.emoji}</Text>
                  <Text
                    className="flex-1 text-sm text-stone-700 dark:text-stone-300"
                    numberOfLines={1}
                  >
                    {formatDisplayName(m?.displayName ?? UNKNOWN_USER)}
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
            <View
              className={`flex-row items-center justify-end rounded-lg px-3 py-2 ${
                customTotal === parsedCents
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : "bg-rose-50 dark:bg-rose-900/20"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  customTotal === parsedCents
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatAmountDisplay(String(customTotal / 100))} /{" "}
                {formatAmountDisplay(String(parsedCents / 100))}
                {customTotal === parsedCents ? " ✓" : " — doesn't match"}
              </Text>
            </View>
          </View>
        )}

        {/* Percentage inputs */}
        {splitType === "percentage" && (
          <View className="mb-5 gap-2.5">
            {Array.from(participantIds).map((uid) => {
              const m = members.find((mem) => mem.userId === uid);
              return (
                <View key={uid} className="flex-row items-center gap-2.5">
                  <Text className="text-sm">{m?.emoji}</Text>
                  <Text
                    className="flex-1 text-sm text-stone-700 dark:text-stone-300"
                    numberOfLines={1}
                  >
                    {formatDisplayName(m?.displayName ?? UNKNOWN_USER)}
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
            <View
              className={`flex-row items-center justify-end rounded-lg px-3 py-2 ${
                percentageTotal === 100
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : "bg-rose-50 dark:bg-rose-900/20"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  percentageTotal === 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {percentageTotal}% / 100%{percentageTotal === 100 ? " ✓" : ""}
              </Text>
            </View>
          </View>
        )}

        {/* Recurring (optional) */}
        {showRecurring && (
          <>
            <View className="mb-5 flex-row items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-900">
              <Text className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Recurring expense
              </Text>
              <Switch
                value={recurring}
                onValueChange={setRecurring}
                trackColor={{ true: "#d97706" }}
              />
            </View>
            {recurring && (
              <View className="mb-5 flex-row rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
                {(["weekly", "monthly", "yearly"] as const).map((freq) => (
                  <Pressable
                    key={freq}
                    onPress={() => setRecurringFrequency(freq)}
                    className={`flex-1 items-center rounded-md py-2 ${
                      recurringFrequency === freq
                        ? "bg-amber-600 shadow-sm dark:bg-amber-500"
                        : ""
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold capitalize ${
                        recurringFrequency === freq
                          ? "text-white"
                          : "text-stone-500 dark:text-stone-400"
                      }`}
                    >
                      {freq}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        {error && (
          <Text className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</Text>
        )}
      </ScrollView>

      {/* Fixed bottom button */}
      <View
        style={{ paddingBottom: insets.bottom + 8 }}
        className="border-t border-stone-100 bg-[#faf9f7] px-4 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]"
      >
        <Button
          onPress={handleSubmit}
          loading={isLoading}
          disabled={!description.trim() || parsedCents <= 0}
        >
          {submitLabel}
        </Button>
      </View>
    </>
  );
}
