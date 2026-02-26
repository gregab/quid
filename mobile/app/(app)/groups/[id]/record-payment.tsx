import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ArrowRight, CheckCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/auth";
import {
  useGroupDetail,
  useGroupExpenses,
  useCreatePayment,
} from "../../../../lib/queries";
import { Button } from "../../../../components/ui/Button";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import {
  buildRawDebts,
  simplifyDebts,
  formatDisplayName,
  formatCents,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  filterAmountInput,
  formatAmountDisplay,
  stripAmountFormatting,
} from "../../../../lib/queries/shared";
import type { Member, UserOwesDebt } from "../../../../lib/types";

type Step = "pick" | "form";

export default function RecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { data: group, isLoading: groupLoading } = useGroupDetail(id!);
  const { data: expenses, isLoading: expensesLoading } =
    useGroupExpenses(id!);
  const createPayment = useCreatePayment(id!);

  const [step, setStep] = useState<Step>("pick");
  const [fromUserId, setFromUserId] = useState<string | null>(null);
  const [toUserId, setToUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [isPreset, setIsPreset] = useState(false);
  const [presetToName, setPresetToName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

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

  const userOwesDebts: UserOwesDebt[] = useMemo(() => {
    if (!expenses || !user) return [];
    const simplified = simplifyDebts(buildRawDebts(expenses));
    const nameMap = new Map(members.map((m) => [m.userId, m.displayName]));
    return simplified
      .filter((d) => d.from === user.id)
      .map((d) => ({
        toId: d.to,
        toName: formatDisplayName(nameMap.get(d.to) ?? UNKNOWN_USER),
        amountCents: d.amount,
      }));
  }, [expenses, members, user]);

  const handleSelectDebt = (debt: UserOwesDebt) => {
    setFromUserId(user!.id);
    setToUserId(debt.toId);
    setAmount(formatAmountDisplay(String(debt.amountCents / 100)));
    setIsPreset(true);
    setPresetToName(debt.toName);
    setError(null);
    setAmountError(null);
    setStep("form");
  };

  const handleRecordOther = () => {
    setFromUserId(user!.id);
    const other = members.find((m) => m.userId !== user!.id);
    setToUserId(other?.userId ?? null);
    setAmount("");
    setIsPreset(false);
    setPresetToName(null);
    setError(null);
    setAmountError(null);
    setStep("form");
  };

  const handleSubmit = async () => {
    setError(null);

    const parsedAmount = parseFloat(stripAmountFormatting(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError("Please enter a valid amount greater than zero.");
      return;
    }
    const amountCents = Math.round(parsedAmount * 100);
    if (amountCents > MAX_AMOUNT_CENTS) {
      setAmountError(
        `Amount cannot exceed $${MAX_AMOUNT_DOLLARS.toLocaleString()}.`,
      );
      return;
    }
    if (!toUserId || !fromUserId || fromUserId === toUserId) {
      setError("From and To must be different people.");
      return;
    }

    const debtForTo = userOwesDebts.find((d) => d.toId === toUserId);
    const settledUp =
      isPreset && !!debtForTo && amountCents === debtForTo.amountCents;

    try {
      await createPayment.mutateAsync({
        groupId: id!,
        amountCents,
        date: new Date().toISOString().split("T")[0]!,
        paidById: fromUserId,
        recipientId: toUserId,
        members,
        settledUp,
      });
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record payment.",
      );
    }
  };

  const fromMember = members.find((m) => m.userId === fromUserId);
  const toMember = members.find((m) => m.userId === toUserId);

  if (groupLoading || expensesLoading) {
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
            onPress={() => {
              if (step === "form" && !isPreset) {
                setStep("pick");
              } else {
                router.back();
              }
            }}
            className="flex-row items-center gap-1"
          >
            <ChevronLeft size={20} color="#78716c" />
            <Text className="text-sm text-stone-500">
              {step === "form" && !isPreset ? "Back" : "Cancel"}
            </Text>
          </Pressable>
          <Text className="text-base font-semibold text-stone-900 dark:text-white">
            Settle up
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === "pick" ? (
            <>
              <Text className="mb-1 text-xl font-bold tracking-tight text-stone-900 dark:text-white">
                Who do you want to pay?
              </Text>
              {userOwesDebts.length > 0 && (
                <Text className="mb-5 text-sm text-stone-400">
                  Select a balance to settle.
                </Text>
              )}

              {userOwesDebts.length > 0 ? (
                <View className="mb-4 gap-2.5">
                  {userOwesDebts.map((debt) => {
                    const toM = members.find((m) => m.userId === debt.toId);
                    return (
                      <Pressable
                        key={debt.toId}
                        onPress={() => handleSelectDebt(debt)}
                        className="flex-row items-center rounded-xl border border-stone-200 bg-white px-4 py-3.5 dark:border-stone-700 dark:bg-stone-900"
                      >
                        <Text className="mr-2.5 text-lg">
                          {toM?.emoji ?? "🐦"}
                        </Text>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-stone-900 dark:text-white">
                            {debt.toName}
                          </Text>
                          <Text className="mt-0.5 text-xs text-stone-400">
                            you owe
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-rose-600 dark:text-rose-400">
                          {formatCents(debt.amountCents)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View className="mb-5 flex-row items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <CheckCircle size={18} color="#16a34a" />
                  <Text className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    You're all settled up!
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleRecordOther}
                className="mt-2"
              >
                <Text className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Record other payment →
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* From → To visual */}
              <View className="mb-6 flex-row items-center justify-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-5 dark:border-stone-700 dark:bg-stone-900">
                {/* From */}
                <View className="items-center">
                  <View className="mb-2 h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Text className="text-xl">
                      {fromMember?.emoji ?? "🐦"}
                    </Text>
                  </View>
                  <Text
                    className="max-w-[80px] text-center text-xs font-medium text-stone-700 dark:text-stone-300"
                    numberOfLines={1}
                  >
                    {fromMember
                      ? formatDisplayName(fromMember.displayName)
                      : "You"}
                  </Text>
                </View>

                <ArrowRight size={20} color="#d97706" />

                {/* To */}
                <View className="items-center">
                  <View className="mb-2 h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <Text className="text-xl">
                      {toMember?.emoji ?? "🐦"}
                    </Text>
                  </View>
                  <Text
                    className="max-w-[80px] text-center text-xs font-medium text-stone-700 dark:text-stone-300"
                    numberOfLines={1}
                  >
                    {presetToName ??
                      (toMember
                        ? formatDisplayName(toMember.displayName)
                        : "—")}
                  </Text>
                </View>
              </View>

              {/* Member selectors (non-preset only) */}
              {!isPreset && (
                <View className="mb-5 gap-4">
                  <View>
                    <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                      From
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {members.map((m) => (
                        <Pressable
                          key={m.userId}
                          onPress={() => {
                            setFromUserId(m.userId);
                            if (toUserId === m.userId) {
                              const other = members.find(
                                (o) => o.userId !== m.userId,
                              );
                              setToUserId(other?.userId ?? null);
                            }
                          }}
                          className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${
                            fromUserId === m.userId
                              ? "bg-amber-600 dark:bg-amber-500"
                              : "bg-stone-100 dark:bg-stone-800"
                          }`}
                        >
                          <Text className="text-sm">{m.emoji}</Text>
                          <Text
                            className={`text-xs font-medium ${
                              fromUserId === m.userId
                                ? "text-white"
                                : "text-stone-700 dark:text-stone-300"
                            }`}
                          >
                            {formatDisplayName(m.displayName)}
                            {m.userId === user?.id ? " (you)" : ""}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <View>
                    <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                      To
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {members
                        .filter((m) => m.userId !== fromUserId)
                        .map((m) => (
                          <Pressable
                            key={m.userId}
                            onPress={() => setToUserId(m.userId)}
                            className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${
                              toUserId === m.userId
                                ? "bg-emerald-600 dark:bg-emerald-500"
                                : "bg-stone-100 dark:bg-stone-800"
                            }`}
                          >
                            <Text className="text-sm">{m.emoji}</Text>
                            <Text
                              className={`text-xs font-medium ${
                                toUserId === m.userId
                                  ? "text-white"
                                  : "text-stone-700 dark:text-stone-300"
                              }`}
                            >
                              {formatDisplayName(m.displayName)}
                            </Text>
                          </Pressable>
                        ))}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Amount — centered large input */}
              <View className="mb-5 items-center py-4">
                <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  Amount
                </Text>
                <View className="flex-row items-baseline">
                  <Text className="text-3xl font-bold text-stone-300 dark:text-stone-600">
                    $
                  </Text>
                  <TextInput
                    className="min-w-[80px] text-center text-4xl font-bold text-stone-900 dark:text-white"
                    placeholder="0.00"
                    placeholderTextColor="#d6d3d1"
                    value={amount}
                    onChangeText={(text) => {
                      setAmount(filterAmountInput(text));
                      setAmountError(null);
                      setError(null);
                    }}
                    keyboardType="decimal-pad"
                    autoFocus={!isPreset}
                  />
                </View>
                {amountError && (
                  <Text className="mt-2 text-xs text-red-500">
                    {amountError}
                  </Text>
                )}
                {isPreset && !amountError && (
                  <Text className="mt-2 text-xs text-stone-400 dark:text-stone-500">
                    Full balance — you can enter a partial amount too
                  </Text>
                )}
              </View>

              {error && (
                <Text className="mb-4 text-sm text-red-600 dark:text-red-400">
                  {error}
                </Text>
              )}
            </>
          )}
        </ScrollView>

        {/* Fixed bottom button (form step only) */}
        {step === "form" && (
          <View
            style={{ paddingBottom: insets.bottom + 8 }}
            className="border-t border-stone-100 bg-[#faf9f7] px-4 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]"
          >
            <Button
              onPress={handleSubmit}
              loading={createPayment.isPending}
              className="bg-emerald-600 dark:bg-emerald-500"
            >
              Record payment
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
