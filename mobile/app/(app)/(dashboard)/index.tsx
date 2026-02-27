import { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Plus, Settings } from "lucide-react-native";
import { useAuth } from "../../../lib/auth";
import { useGroups, useCurrentUser, useContacts } from "../../../lib/queries";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { DashboardSkeleton } from "../../../components/ui/SkeletonLoader";
import { ErrorState } from "../../../components/ui/ErrorState";
import { GroupThumbnail } from "../../../components/ui/GroupThumbnail";
import { formatCents, BIRD_FACTS, formatDisplayName } from "../../../lib/queries/shared";
import type { GroupSummary } from "../../../lib/types";

interface FriendInfo {
  userId: string;
  displayName: string;
  emoji: string | null;
  groupId: string;
  balanceCents: number;
}

function GroupCard({ group }: { group: GroupSummary }) {
  const router = useRouter();
  const monthLabel = new Date(group.createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <Pressable
      onPress={() => router.push(`/(app)/groups/${group.id}`)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
      className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
    >
      {/* Thumbnail */}
      <GroupThumbnail patternSeed={group.patternSeed} bannerUrl={group.bannerUrl} />

      {/* Group info */}
      <View className="min-w-0 flex-1">
        <Text
          className="text-base font-semibold text-stone-900 dark:text-white"
          numberOfLines={1}
        >
          {group.name}
        </Text>
        <Text className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          {" · "}
          {monthLabel}
        </Text>
      </View>

      {/* Balance */}
      <View className="flex-row items-center gap-1.5">
        {group.balanceCents === 0 ? (
          <Text className="text-[11px] font-medium text-stone-400 dark:text-stone-500">
            settled
          </Text>
        ) : (
          <View className="items-end">
            <Text
              className={`text-[11px] ${
                group.balanceCents > 0
                  ? "text-emerald-600/70 dark:text-emerald-400/70"
                  : "text-rose-500/70 dark:text-rose-400/70"
              }`}
            >
              {group.balanceCents > 0 ? "you are owed" : "you owe"}
            </Text>
            <Text
              className={`text-sm font-bold ${
                group.balanceCents > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              {formatCents(Math.abs(group.balanceCents))}
            </Text>
          </View>
        )}
        <ChevronRight size={15} color="#a8a29e" />
      </View>
    </Pressable>
  );
}

function FriendCard({ friend }: { friend: FriendInfo }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/(app)/groups/${friend.groupId}`)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
      className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
    >
      {/* Avatar */}
      <View className="h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Text className="text-lg">{friend.emoji ?? "🐦"}</Text>
      </View>

      {/* Name */}
      <View className="min-w-0 flex-1">
        <Text
          className="text-base font-semibold text-stone-900 dark:text-white"
          numberOfLines={1}
        >
          {formatDisplayName(friend.displayName)}
        </Text>
      </View>

      {/* Balance */}
      <View className="flex-row items-center gap-1.5">
        {friend.balanceCents === 0 ? (
          <Text className="text-[11px] font-medium text-stone-400 dark:text-stone-500">
            settled
          </Text>
        ) : (
          <View className="items-end">
            <Text
              className={`text-[11px] ${
                friend.balanceCents > 0
                  ? "text-emerald-600/70 dark:text-emerald-400/70"
                  : "text-rose-500/70 dark:text-rose-400/70"
              }`}
            >
              {friend.balanceCents > 0 ? "you are owed" : "you owe"}
            </Text>
            <Text
              className={`text-sm font-bold ${
                friend.balanceCents > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              {formatCents(Math.abs(friend.balanceCents))}
            </Text>
          </View>
        )}
        <ChevronRight size={15} color="#a8a29e" />
      </View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: groups, isLoading, isError, refetch } = useGroups();
  const { data: profile } = useCurrentUser();
  const { data: contacts } = useContacts();
  const [refreshing, setRefreshing] = useState(false);
  const hasAnimated = useRef(false);

  // Mark animations as done after first render with data
  useEffect(() => {
    if (groups && !hasAnimated.current) {
      hasAnimated.current = true;
    }
  }, [groups]);

  const birdFact = useMemo(
    () => BIRD_FACTS[Math.floor(Math.random() * BIRD_FACTS.length)],
    [],
  );

  const regularGroups = useMemo(
    () => (groups ?? []).filter((g) => !g.isFriendGroup),
    [groups],
  );

  const friendGroups = useMemo(
    () => (groups ?? []).filter((g) => g.isFriendGroup),
    [groups],
  );

  const friends: FriendInfo[] = useMemo(
    () =>
      friendGroups.map((g) => ({
        userId: g.id,
        displayName: g.friendName ?? g.name,
        emoji: g.emoji,
        groupId: g.id,
        balanceCents: g.balanceCents,
      })),
    [friendGroups],
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
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 justify-center">
          <ErrorState
            message="Couldn't load your groups. Check your connection and try again."
            onRetry={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <FlatList
        data={regularGroups}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d97706"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View className="mb-4 mt-3 flex-row items-center justify-between">
              <Text className="font-serif-logo text-2xl text-stone-800 dark:text-stone-100">
                Aviary
              </Text>
              <Pressable
                onPress={() => router.push("/(app)/settings")}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Settings size={22} color="#78716c" />
              </Pressable>
            </View>

            {/* Hero card */}
            <Card className="mb-6 overflow-hidden rounded-2xl">
              <View className="relative bg-amber-600 px-5 pb-6 pt-7 dark:bg-amber-700">
                {/* Decorative circles for depth */}
                <View
                  className="absolute right-[-20px] top-[-30px] h-28 w-28 rounded-full bg-amber-500/40 dark:bg-amber-600/30"
                  pointerEvents="none"
                />
                <View
                  className="absolute bottom-[-10px] right-[60px] h-16 w-16 rounded-full bg-amber-700/30 dark:bg-amber-800/30"
                  pointerEvents="none"
                />

                <Text className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-200/80">
                  Your balance
                </Text>
                <Text className="text-[26px] font-bold leading-tight tracking-tight text-white">
                  Hey {displayName}.
                </Text>
                {(groups ?? []).length > 0 && (
                  <Text className="mt-1.5 text-[15px] font-medium text-white/85">
                    {totalBalance === 0
                      ? "You're all settled up 🎉"
                      : totalBalance > 0
                        ? `You are owed ${formatCents(totalBalance)}`
                        : `You owe ${formatCents(Math.abs(totalBalance))}`}
                  </Text>
                )}
              </View>
            </Card>

            {/* Section header */}
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
                Your groups
              </Text>
              <Pressable
                onPress={() => router.push("/(app)/(dashboard)/create-group")}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                className="flex-row items-center gap-1 rounded-full bg-amber-600 px-3 py-1.5 dark:bg-amber-500"
              >
                <Plus size={12} color="#fff" strokeWidth={3} />
                <Text className="text-[11px] font-bold tracking-wide text-white">
                  New group
                </Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={!hasAnimated.current ? FadeInDown.duration(200).delay(index * 40) : undefined}
          >
            <GroupCard group={item} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Text className="text-2xl">🪺</Text>}
            title="Welcome to the nest"
            subtitle="Start a group to split expenses with friends, roommates, or travel buddies."
            action={{
              label: "Create your first group",
              onPress: () =>
                router.push("/(app)/(dashboard)/create-group"),
            }}
          />
        }
        ListFooterComponent={
          <>
            {/* Friends section */}
            {friends.length > 0 && (
              <View className="mt-6">
                <View className="mb-2 flex-row items-center">
                  <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
                    Friends
                  </Text>
                </View>

                {friends.map((friend, index) => (
                  <Animated.View
                    key={friend.groupId}
                    entering={!hasAnimated.current ? FadeInDown.duration(200).delay(index * 40) : undefined}
                  >
                    <FriendCard friend={friend} />
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Bird fact */}
            {groups && groups.length > 0 ? (
              <Card className="mt-6 px-5 py-4">
                <Text className="text-[11px] font-bold uppercase tracking-widest text-amber-700/80 dark:text-amber-400/70">
                  Bird fact
                </Text>
                <Text className="mt-1.5 font-serif-logo text-base leading-relaxed text-stone-700 dark:text-stone-300">
                  {birdFact}
                </Text>
              </Card>
            ) : null}
          </>
        }
      />
    </SafeAreaView>
  );
}
