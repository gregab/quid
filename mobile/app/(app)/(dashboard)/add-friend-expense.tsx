import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useContacts, useCreateFriendExpense } from "../../../lib/queries";
import { useAuth } from "../../../lib/auth";
import { Button } from "../../../components/ui/Button";
import { ExpenseForm, type ExpenseFormData } from "../../../components/ExpenseForm";
import {
  formatDisplayName,
  MEMBER_EMOJIS,
  UNKNOWN_USER,
} from "../../../lib/queries/shared";
import type { Member } from "../../../lib/types";

export default function AddFriendExpenseScreen() {
  const router = useRouter();
  const { friendId } = useLocalSearchParams<{ friendId?: string }>();
  const { user } = useAuth();
  const { data: contacts } = useContacts();
  const createFriendExpense = useCreateFriendExpense();
  const insets = useSafeAreaInsets();

  // Single-select: string | null — pre-selected when navigated from picker
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(friendId ?? null);

  const toggleFriend = (userId: string) => {
    setSelectedFriendId((prev) => (prev === userId ? null : userId));
  };

  const selectedFriend = useMemo(
    () => (contacts ?? []).find((c) => c.userId === selectedFriendId) ?? null,
    [contacts, selectedFriendId],
  );

  // Build members array for ExpenseForm when a friend is selected
  const members: Member[] = useMemo(() => {
    if (!user || !selectedFriend) return [];
    return [
      {
        userId: user.id,
        displayName: (user.user_metadata?.display_name as string | undefined) ?? UNKNOWN_USER,
        emoji: MEMBER_EMOJIS[0]!,
      },
      {
        userId: selectedFriend.userId,
        displayName: selectedFriend.displayName,
        emoji: MEMBER_EMOJIS[1]!,
      },
    ];
  }, [user, selectedFriend]);

  const handleSubmit = async (data: ExpenseFormData) => {
    if (!selectedFriendId) return;
    await createFriendExpense.mutateAsync({
      friendIds: [selectedFriendId],
      description: data.description,
      amountCents: data.amountCents,
      date: data.date,
      paidById: data.paidById,
      splitType: data.splitType,
      splitAmounts: data.splitAmounts,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const contactList = contacts ?? [];

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
            onPress={() => router.back()}
            className="flex-row items-center gap-1"
          >
            <ChevronLeft size={20} color="#78716c" />
            <Text className="text-sm text-stone-500">Cancel</Text>
          </Pressable>
          <Text className="text-base font-semibold text-stone-900 dark:text-white">
            Add expense
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Friend selector — always visible above form */}
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: selectedFriend ? 0 : 120 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!selectedFriend}
        >
          <View className="mb-5">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Split with
            </Text>
            {contactList.length === 0 ? (
              <Text className="text-sm text-stone-400 dark:text-stone-500">
                No contacts yet. Join a group first.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {contactList.map((contact) => {
                  const isSelected = selectedFriendId === contact.userId;
                  return (
                    <Pressable
                      key={contact.userId}
                      onPress={() => toggleFriend(contact.userId)}
                      className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${
                        isSelected
                          ? "bg-amber-600 dark:bg-amber-500"
                          : "bg-stone-100 dark:bg-stone-800"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          isSelected
                            ? "text-white"
                            : "text-stone-700 dark:text-stone-300"
                        }`}
                      >
                        {formatDisplayName(contact.displayName)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* ExpenseForm — only when a friend is selected */}
        {selectedFriend && user && (
          <ExpenseForm
            members={members}
            currentUserId={user.id}
            onSubmit={handleSubmit}
            isLoading={createFriendExpense.isPending}
            showRecurring={false}
            submitLabel="Add expense"
          />
        )}

        {/* Prompt to select a friend when none selected */}
        {!selectedFriend && contactList.length > 0 && (
          <View
            style={{ paddingBottom: insets.bottom + 8 }}
            className="border-t border-stone-100 bg-[#faf9f7] px-4 pt-3 dark:border-stone-800/60 dark:bg-[#0c0a09]"
          >
            <Button disabled onPress={() => {}}>Select a friend above</Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
