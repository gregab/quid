import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UserPlus, CheckCircle2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAddMember } from "../../../../lib/queries";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { ScreenHeader } from "../../../../components/ui/ScreenHeader";

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
        <View style={{ paddingTop: insets.top }}>
          <ScreenHeader
            title="Add member"
            onBack={() => router.back()}
            rightAction={
              <Pressable onPress={() => router.back()}>
                <Text className="text-sm font-semibold text-amber-600 dark:text-amber-500">Done</Text>
              </Pressable>
            }
          />
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 items-center px-4 pt-10">
            {/* Icon */}
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <UserPlus size={28} color="#d97706" />
            </View>

            <Text className="mb-2 text-center text-lg font-bold tracking-tight text-stone-900 dark:text-white">
              Invite by email
            </Text>
            <Text className="mb-8 text-center text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              Enter the email address of the person you'd like to add.{"\n"}
              They must already have an Aviary account.
            </Text>

            <View className="w-full gap-4">
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
            </View>
          </View>
        </ScrollView>

        {/* Bottom submit button */}
        <View
          style={{ paddingBottom: insets.bottom + 16 }}
          className="border-t border-stone-100 px-4 pt-3 dark:border-stone-800/60"
        >
          <Button
            onPress={handleSubmit}
            loading={addMember.isPending}
            disabled={!email.trim()}
            size="lg"
          >
            Add member
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
