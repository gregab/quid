import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Plus, Settings } from "lucide-react-native";
import { useAuth } from "../../../lib/auth";
import { useGroups, useCurrentUser } from "../../../lib/queries";
import { Card } from "../../../components/ui/Card";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { formatCents, BIRD_FACTS } from "../../../lib/queries/shared";
import type { GroupSummary } from "../../../lib/types";

function GroupCard({ group }: { group: GroupSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/(app)/groups/${group.id}`)}
      className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
    >
      {/* Thumbnail placeholder */}
      <View className="h-11 w-11 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
        <Text className="text-lg">{group.emoji ?? "🐦"}</Text>
      </View>

      {/* Group info */}
      <View className="min-w-0 flex-1">
        <Text
          className="text-base font-semibold text-stone-900 dark:text-white"
          numberOfLines={1}
        >
          {group.name}
        </Text>
        <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        </Text>
      </View>

      {/* Balance */}
      <View className="flex-row items-center gap-1.5">
        {group.balanceCents !== 0 && (
          <View className="items-end">
            <Text
              className={`text-[11px] ${
                group.balanceCents > 0
                  ? "text-emerald-600/70 dark:text-emerald-400/70"
                  : "text-rose-600/70 dark:text-rose-400/70"
              }`}
            >
              {group.balanceCents > 0 ? "you are owed" : "you owe"}
            </Text>
            <Text
              className={`text-sm font-semibold ${
                group.balanceCents > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatCents(Math.abs(group.balanceCents))}
            </Text>
          </View>
        )}
        <ChevronRight size={16} color="#d6d3d1" />
      </View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: groups, isLoading, refetch } = useGroups();
  const { data: profile } = useCurrentUser();
  const [refreshing, setRefreshing] = useState(false);

  const birdFact = useMemo(
    () => BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)],
    [],
  );

  const totalBalance = useMemo(
    () => (groups ?? []).reduce((sum, g) => sum + g.balanceCents, 0),
    [groups],
  );

  const displayName =
    profile?.displayName ??
    user?.user_metadata?.display_name ??
    user?.email?.split("@")[0] ??
    "friend";

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner text="Loading groups..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <FlatList
        data={groups ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d97706"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View className="mb-4 mt-2 flex-row items-center justify-between">
              <Text className="font-serif-logo text-2xl text-stone-800 dark:text-stone-100">
                Aviary
              </Text>
              <Pressable onPress={() => router.push("/(app)/settings")}>
                <Settings size={22} color="#78716c" />
              </Pressable>
            </View>

            {/* Hero card */}
            <Card className="mb-6 overflow-hidden">
              <View className="bg-amber-600 px-5 pb-5 pt-8 dark:bg-amber-700">
                <Text className="text-2xl font-bold tracking-tight text-white">
                  Hey {displayName}.
                </Text>
                {(groups ?? []).length > 0 && (
                  <Text className="mt-1 text-base text-white/90">
                    {totalBalance === 0
                      ? "You're all settled up!"
                      : totalBalance > 0
                        ? `You are owed ${formatCents(totalBalance)}`
                        : `You owe ${formatCents(Math.abs(totalBalance))}`}
                  </Text>
                )}
              </View>
            </Card>

            {/* Section header */}
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold tracking-tight text-stone-900 dark:text-white">
                Your groups
              </Text>
              <Pressable
                onPress={() => router.push("/(app)/(dashboard)/create-group")}
                className="flex-row items-center gap-1 rounded-full bg-amber-600 px-3.5 py-1.5 dark:bg-amber-500"
              >
                <Plus size={14} color="#fff" strokeWidth={3} />
                <Text className="text-xs font-semibold text-white">
                  New group
                </Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => <GroupCard group={item} />}
        ListEmptyComponent={
          <Card className="items-center px-5 py-12">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-amber-600">
              <Text className="text-2xl text-white">A</Text>
            </View>
            <Text className="mb-1.5 text-lg font-bold text-stone-800 dark:text-stone-200">
              Welcome to the nest
            </Text>
            <Text className="mb-6 text-center text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Start a group to split expenses with friends, roommates, or travel
              buddies.
            </Text>
            <Pressable
              onPress={() =>
                router.push("/(app)/(dashboard)/create-group")
              }
              className="rounded-xl bg-amber-600 px-6 py-3 dark:bg-amber-500"
            >
              <Text className="font-semibold text-white">
                Create your first group
              </Text>
            </Pressable>
            <Text className="mt-3 text-xs text-stone-500 dark:text-stone-400">
              Or ask a friend for an invite link to join theirs
            </Text>
          </Card>
        }
        ListFooterComponent={
          groups && groups.length > 0 ? (
            <Card className="mt-6 px-5 py-4">
              <Text className="text-[11px] font-bold uppercase tracking-widest text-amber-700/80 dark:text-amber-400/70">
                Bird fact
              </Text>
              <Text className="mt-1.5 font-serif-logo text-base leading-relaxed text-stone-700 dark:text-stone-300">
                {birdFact}
              </Text>
            </Card>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
