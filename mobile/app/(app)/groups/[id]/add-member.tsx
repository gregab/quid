import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, CheckCircle2, UserPlus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAddMember } from "../../../../lib/queries";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";

export default function AddMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addMember = useAddMember(id!);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      const result = await addMember.mutateAsync(trimmed);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      setSuccess(
        `${result.displayName ?? trimmed} has been added to the group!`,
      );
      setEmail("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add member.";
      setError(message);
    }
  };

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
            <Text className="text-sm text-stone-500">Done</Text>
          </Pressable>
          <Text className="text-base font-semibold text-stone-900 dark:text-white">
            Add member
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <View className="flex-1 px-4 pt-6">
          {/* Icon */}
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <UserPlus size={22} color="#d97706" />
          </View>

          <Text className="mb-2 text-lg font-bold tracking-tight text-stone-900 dark:text-white">
            Invite by email
          </Text>
          <Text className="mb-6 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            Enter the email address of the person you'd like to add. They must
            already have an Aviary account.
          </Text>

          <View className="gap-4">
            <Input
              label="Email address"
              placeholder="friend@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
                setSuccess(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              error={error ?? undefined}
            />

            {success && (
              <View className="flex-row items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <CheckCircle2 size={18} color="#16a34a" />
                <Text className="flex-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {success}
                </Text>
              </View>
            )}

            <Button
              onPress={handleSubmit}
              loading={addMember.isPending}
              disabled={!email.trim()}
            >
              Add member
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
