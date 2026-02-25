import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAddMember } from "../../../../lib/queries";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";

export default function AddMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
      const message = err instanceof Error ? err.message : "Failed to add member.";
      setError(message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-4 pt-4">
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
              Add member
            </Text>
            <Button variant="ghost" onPress={() => router.back()}>
              Done
            </Button>
          </View>

          <Text className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            Add someone by their email address. They must already have an
            Aviary account.
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
              <View className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                <Text className="text-sm text-emerald-700 dark:text-emerald-300">
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
    </SafeAreaView>
  );
}
