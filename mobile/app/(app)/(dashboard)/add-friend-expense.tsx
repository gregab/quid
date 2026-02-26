import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useContacts, useCreateFriendExpense } from "../../../lib/queries";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  formatDisplayName,
  MAX_EXPENSE_DESCRIPTION,
  MAX_AMOUNT_CENTS,
} from "../../../lib/queries/shared";

export default function AddFriendExpenseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: contacts } = useContacts();
  const createFriendExpense = useCreateFriendExpense();

  const { showToast } = useToast();

  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(
    new Set(),
  );
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0]!,
  );
  const [paidById, setPaidById] = useState<string | undefined>(undefined);

  const toggleFriend = useCallback(
    (userId: string) => {
      setSelectedFriends((prev) => {
        const next = new Set(prev);
        if (next.has(userId)) {
          next.delete(userId);
        } else {
          next.add(userId);
        }
        return next;
      });
      setPaidById(undefined); // Reset payer when selection changes
    },
    [],
  );

  const amountCents = useMemo(() => {
    const val = parseFloat(amountStr.replace(/[^0-9.]/g, ""));
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [amountStr]);

  const showPayerSelector = selectedFriends.size === 1;
  const singleFriend = showPayerSelector
    ? (contacts ?? []).find((c) => selectedFriends.has(c.userId))
    : null;

  const handleSubmit = async () => {
    const friendIds = Array.from(selectedFriends);
    if (friendIds.length === 0) {
      showToast({ message: "Select at least one friend.", type: "error" });
      return;
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      showToast({ message: "Description is required.", type: "error" });
      return;
    }

    if (amountCents <= 0) {
      showToast({ message: "Enter a valid amount.", type: "error" });
      return;
    }
    if (amountCents > MAX_AMOUNT_CENTS) {
      showToast({ message: "Amount is too large.", type: "error" });
      return;
    }

    try {
      await createFriendExpense.mutateAsync({
        friendIds,
        description: trimmedDesc,
        amountCents,
        date,
        paidById: paidById ?? user?.id,
      });
      router.back();
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Failed to add expense.",
        type: "error",
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
              Add expense with friends
            </Text>
            <Button variant="ghost" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>

          {/* Friend selector */}
          <View className="mb-5">
            <Text className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
              Split with
            </Text>
            {(contacts ?? []).length === 0 ? (
              <Text className="text-sm text-stone-400 dark:text-stone-500">
                No contacts yet. Join a group first.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {(contacts ?? []).map((contact) => {
                  const isSelected = selectedFriends.has(contact.userId);
                  return (
                    <Pressable
                      key={contact.userId}
                      onPress={() => toggleFriend(contact.userId)}
                      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                        isSelected
                          ? "bg-amber-100 dark:bg-amber-900/40"
                          : "bg-stone-100 dark:bg-stone-800"
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          isSelected
                            ? "text-amber-800 dark:text-amber-300"
                            : "text-stone-600 dark:text-stone-400"
                        }`}
                      >
                        {formatDisplayName(contact.displayName)}
                      </Text>
                      {isSelected && <Check size={14} color="#92400e" />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Description */}
          <View className="mb-4">
            <Input
              label="Description"
              placeholder="Dinner, groceries, etc."
              value={description}
              onChangeText={setDescription}
              maxLength={MAX_EXPENSE_DESCRIPTION}
            />
          </View>

          {/* Amount */}
          <View className="mb-4">
            <Input
              label="Amount"
              placeholder="$0.00"
              value={amountStr}
              onChangeText={(text) =>
                setAmountStr(text.replace(/[^0-9.]/g, ""))
              }
              keyboardType="decimal-pad"
            />
          </View>

          {/* Payer selector — only when 1 friend selected */}
          {showPayerSelector && singleFriend && user && (
            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                Paid by
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setPaidById(user.id)}
                  className={`flex-1 items-center rounded-lg px-3 py-2.5 ${
                    !paidById || paidById === user.id
                      ? "bg-amber-100 dark:bg-amber-900/40"
                      : "bg-stone-100 dark:bg-stone-800"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      !paidById || paidById === user.id
                        ? "text-amber-800 dark:text-amber-300"
                        : "text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    You
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPaidById(singleFriend.userId)}
                  className={`flex-1 items-center rounded-lg px-3 py-2.5 ${
                    paidById === singleFriend.userId
                      ? "bg-amber-100 dark:bg-amber-900/40"
                      : "bg-stone-100 dark:bg-stone-800"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      paidById === singleFriend.userId
                        ? "text-amber-800 dark:text-amber-300"
                        : "text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    {formatDisplayName(singleFriend.displayName)}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Split info */}
          {selectedFriends.size > 0 && amountCents > 0 && (
            <Text className="mb-4 text-xs text-stone-400 dark:text-stone-500">
              Split equally between you and {selectedFriends.size}{" "}
              {selectedFriends.size === 1 ? "friend" : "friends"}
            </Text>
          )}

          {/* Submit */}
          <Button
            onPress={handleSubmit}
            loading={createFriendExpense.isPending}
            disabled={
              selectedFriends.size === 0 ||
              !description.trim() ||
              amountCents <= 0
            }
          >
            Add expense
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
