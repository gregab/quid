import { useState, useMemo } from "react";
import { View, Text, Pressable, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Link as LinkIcon, UserPlus, LogOut } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/auth";
import {
  useGroupDetail,
  useGroupExpenses,
  useLeaveGroup,
} from "../../../../lib/queries";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import {
  getUserDebtCents,
  formatCents,
  UNKNOWN_USER,
} from "../../../../lib/queries/shared";

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroupDetail(id!);
  const { data: expenses } = useGroupExpenses(id!);
  const leaveGroup = useLeaveGroup(id!);

  const [leaving, setLeaving] = useState(false);

  const outstandingCents = useMemo(() => {
    if (!expenses || !user) return 0;
    return getUserDebtCents(expenses, user.id);
  }, [expenses, user]);

  const groupName = (group as Record<string, unknown> | undefined)?.name as
    | string
    | undefined;
  const inviteToken = (group as Record<string, unknown> | undefined)
    ?.inviteToken as string | undefined;
  const memberCount = (
    (group as Record<string, unknown> | undefined)?.GroupMember as
      | unknown[]
      | undefined
  )?.length ?? 0;

  const handleShareInvite = async () => {
    if (!inviteToken) return;
    const url = `https://aviary.gregbigelow.com/invite/${inviteToken}`;
    try {
      await Share.share({ message: `Join my group on Aviary: ${url}` });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // User cancelled
    }
  };

  const handleLeave = () => {
    if (outstandingCents > 0) {
      Alert.alert(
        "Outstanding balance",
        `You owe ${formatCents(outstandingCents)} in this group. Please settle up before leaving.`,
      );
      return;
    }

    Alert.alert(
      "Leave group",
      `Are you sure you want to leave "${groupName}"?${
        memberCount === 1 ? " Since you're the last member, this will delete the group." : ""
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveGroup.mutateAsync();
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              router.replace("/(app)/(dashboard)");
            } catch (err) {
              setLeaving(false);
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to leave group.",
              );
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <View className="flex-1 px-4 pt-2">
        {/* Header */}
        <Pressable
          onPress={() => router.back()}
          className="mb-4 flex-row items-center gap-1"
        >
          <ChevronLeft size={20} color="#78716c" />
          <Text className="text-sm text-stone-500">Back</Text>
        </Pressable>

        <Text className="mb-6 text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          Group settings
        </Text>

        <View className="gap-3">
          {/* Group name */}
          <Card className="px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Group name
            </Text>
            <Text className="mt-1 text-base font-semibold text-stone-900 dark:text-white">
              {groupName}
            </Text>
          </Card>

          {/* Members */}
          <Card className="px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Members
            </Text>
            <Text className="mt-1 text-sm text-stone-700 dark:text-stone-300">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </Text>
          </Card>

          {/* Actions */}
          <Pressable
            onPress={handleShareInvite}
            className="flex-row items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
          >
            <LinkIcon size={18} color="#78716c" />
            <Text className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Share invite link
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/(app)/groups/${id}/add-member`)}
            className="flex-row items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
          >
            <UserPlus size={18} color="#78716c" />
            <Text className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Add member by email
            </Text>
          </Pressable>
        </View>

        {/* Leave group */}
        <View className="mt-auto pb-8">
          <Button
            variant="danger"
            onPress={handleLeave}
            loading={leaving}
          >
            <View className="flex-row items-center gap-2">
              <LogOut size={16} color="#fff" />
              <Text className="text-sm font-semibold text-white">
                Leave group
              </Text>
            </View>
          </Button>
          {outstandingCents > 0 && (
            <Text className="mt-2 text-center text-xs text-rose-500 dark:text-rose-400">
              You owe {formatCents(outstandingCents)} — settle up first.
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
