import { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/auth";
import {
  useGroupDetail,
  useGroupExpenses,
  useCreatePayment,
} from "../../../../lib/queries";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
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
  const { data: group, isLoading: groupLoading } = useGroupDetail(id!);
  const { data: expenses, isLoading: expensesLoading } = useGroupExpenses(id!);
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

  // Compute debts the current user owes
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
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    }
  };

  if (groupLoading || expensesLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const currentUserName =
    members.find((m) => m.userId === user?.id)?.displayName ?? "";

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
          </View>

          {step === "pick" ? (
            /* Step 1: Pick who to pay */
            <>
              <Text className="mb-1 text-xl font-bold text-stone-900 dark:text-white">
                Settle up
              </Text>
              {userOwesDebts.length > 0 && (
                <Text className="mb-4 text-sm text-stone-400">
                  Select who you want to pay.
                </Text>
              )}

              {userOwesDebts.length > 0 ? (
                <View className="mb-4 gap-2">
                  {userOwesDebts.map((debt) => (
                    <Pressable
                      key={debt.toId}
                      onPress={() => handleSelectDebt(debt)}
                      className="flex-row items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 dark:border-stone-700 dark:bg-stone-800"
                    >
                      <View>
                        <Text className="text-sm font-semibold text-stone-900 dark:text-white">
                          {debt.toName}
                        </Text>
                        <Text className="mt-0.5 text-xs text-stone-400">
                          you owe
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-bold text-red-600 dark:text-red-400">
                          {formatCents(debt.amountCents)}
                        </Text>
                        <ChevronRight size={16} color="#d6d3d1" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="mb-4 flex-row items-center gap-2">
                  <CheckCircle size={16} color="#16a34a" />
                  <Text className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    You're all settled up!
                  </Text>
                </View>
              )}

              <Pressable onPress={handleRecordOther}>
                <Text className="text-sm text-stone-400 dark:text-stone-500">
                  Record other payment →
                </Text>
              </Pressable>
            </>
          ) : (
            /* Step 2: Payment form */
            <>
              <Text className="mb-4 text-xl font-bold text-stone-900 dark:text-white">
                {presetToName ? `Pay ${presetToName}` : "Record a payment"}
              </Text>

              <View className="gap-4">
                {/* From */}
                <View>
                  <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    From
                  </Text>
                  {isPreset ? (
                    <View className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800">
                      <Text className="text-sm text-stone-700 dark:text-stone-300">
                        {currentUserName} (you)
                      </Text>
                    </View>
                  ) : (
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
                          className={`rounded-full px-3 py-1.5 ${
                            fromUserId === m.userId
                              ? "bg-amber-600 dark:bg-amber-500"
                              : "bg-stone-100 dark:bg-stone-800"
                          }`}
                        >
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
                  )}
                </View>

                {/* To */}
                <View>
                  <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    To
                  </Text>
                  {isPreset ? (
                    <View className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800">
                      <Text className="text-sm text-stone-700 dark:text-stone-300">
                        {presetToName}
                      </Text>
                    </View>
                  ) : (
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
                            className={`rounded-full px-3 py-1.5 ${
                              toUserId === m.userId
                                ? "bg-emerald-600 dark:bg-emerald-500"
                                : "bg-stone-100 dark:bg-stone-800"
                            }`}
                          >
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
                  )}
                </View>

                {/* Amount */}
                <Input
                  label="Amount ($)"
                  placeholder="0.00"
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(filterAmountInput(text));
                    setAmountError(null);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  autoFocus
                  error={amountError ?? undefined}
                />
                {isPreset && !amountError && (
                  <Text className="text-xs text-stone-400 dark:text-stone-500">
                    Full balance owed — you can pay a partial amount too.
                  </Text>
                )}

                {error && (
                  <Text className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </Text>
                )}

                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button variant="ghost" onPress={() => router.back()}>
                      Cancel
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      onPress={handleSubmit}
                      loading={createPayment.isPending}
                    >
                      Record payment
                    </Button>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
