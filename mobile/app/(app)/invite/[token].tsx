import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../lib/auth";
import { useInvitePreview, useJoinGroup } from "../../../lib/queries";
import { Button } from "../../../components/ui/Button";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { useState, useEffect } from "react";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const {
    data: preview,
    isLoading,
    error: previewError,
  } = useInvitePreview(token!);
  const joinGroup = useJoinGroup();
  const [error, setError] = useState<string | null>(null);

  // Not authenticated — redirect to login
  useEffect(() => {
    if (!session) {
      router.replace(`/(auth)/login?next=/invite/${token}` as never);
    }
  }, [session, router, token]);

  // Already a member — redirect to group
  useEffect(() => {
    if (preview?.isMember) {
      router.replace(`/(app)/groups/${preview.id}` as never);
    }
  }, [preview, router]);

  if (!session || preview?.isMember) {
    return null;
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
      setError(
        err instanceof Error ? err.message : "Failed to join group.",
      );
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
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-5xl">🐦</Text>
          <Text className="text-lg font-bold text-stone-800 dark:text-stone-200">
            Invalid invite link
          </Text>
          <Text className="mt-2 text-center text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            This invite link may have expired or is invalid.
          </Text>
          <View className="mt-6 w-full">
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
      <View className="flex-1 items-center justify-center px-6">
        {/* Amber header band */}
        <View className="w-full overflow-hidden rounded-2xl">
          <View className="items-center bg-amber-600 px-6 pb-8 pt-10 dark:bg-amber-700">
            <Text className="font-serif-logo text-xl text-white/80">
              Aviary
            </Text>
            <Text className="mt-4 text-5xl">🐦</Text>
            <Text className="mt-3 text-sm font-medium text-amber-100">
              You've been invited to join
            </Text>
          </View>

          {/* Content area */}
          <View className="items-center rounded-b-2xl bg-white px-6 pb-8 pt-6 dark:bg-stone-900">
            <Text className="text-2xl font-bold text-stone-900 dark:text-white">
              {preview.name}
            </Text>
            <Text className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
              {preview.memberCount}{" "}
              {preview.memberCount === 1 ? "member" : "members"}
            </Text>

            {error && (
              <Text className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </Text>
            )}

            <View className="mt-6 w-full">
              <Button
                onPress={handleJoin}
                loading={joinGroup.isPending}
                size="lg"
              >
                Join {preview.name}
              </Button>
            </View>

            <Text className="mt-4 text-center text-xs leading-relaxed text-stone-400 dark:text-stone-500">
              You've been invited to join this group on Aviary.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
