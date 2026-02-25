import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../lib/auth";
import { useInvitePreview, useJoinGroup } from "../../../lib/queries";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { useState } from "react";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { data: preview, isLoading, error: previewError } = useInvitePreview(token!);
  const joinGroup = useJoinGroup();
  const [error, setError] = useState<string | null>(null);

  // Not authenticated — redirect to login
  if (!session) {
    return <Redirect href={`/(auth)/login?next=/invite/${token}`} />;
  }

  // Already a member — redirect to group
  if (preview?.isMember) {
    return <Redirect href={`/(app)/groups/${preview.id}`} />;
  }

  const handleJoin = async () => {
    setError(null);
    try {
      const result = await joinGroup.mutateAsync(token!);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      router.replace(`/(app)/groups/${result.groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group.");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner text="Loading invite..." />
      </SafeAreaView>
    );
  }

  if (previewError || !preview) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-lg font-semibold text-stone-800 dark:text-stone-200">
            Invalid invite link
          </Text>
          <Text className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            This invite link may have expired or is invalid.
          </Text>
          <View className="mt-6">
            <Button onPress={() => router.replace("/(app)/(dashboard)")}>
              Go to dashboard
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <View className="flex-1 items-center justify-center px-4">
        <Card className="w-full max-w-sm items-center px-6 py-8">
          <Text className="text-4xl">🐦</Text>
          <Text className="mt-3 text-xl font-bold text-stone-900 dark:text-white">
            {preview.name}
          </Text>
          <Text className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {preview.memberCount}{" "}
            {preview.memberCount === 1 ? "member" : "members"}
          </Text>

          <Text className="mt-4 text-center text-sm text-stone-600 dark:text-stone-400">
            You've been invited to join this group on Aviary.
          </Text>

          {error && (
            <Text className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </Text>
          )}

          <View className="mt-6 w-full">
            <Button onPress={handleJoin} loading={joinGroup.isPending}>
              Join {preview.name}
            </Button>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}
