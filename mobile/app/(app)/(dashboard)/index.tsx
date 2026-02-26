import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { ChevronRight, Plus, Settings, UserPlus } from "lucide-react-native";
import { useAuth } from "../../../lib/auth";
import { useGroups, useCurrentUser, useContacts } from "../../../lib/queries";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { GroupThumbnail } from "../../../components/ui/GroupThumbnail";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import {
  formatCents,
  BIRD_FACTS,
  formatDisplayName,
  getGroupColor,
} from "../../../lib/queries/shared";
import type { GroupSummary } from "../../../lib/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Derive a stable integer from a UUID string for color indexing. */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface FriendInfo {
  userId: string;
  displayName: string;
  emoji: string | null;
  groupId: string;
  balanceCents: number;
}

function PressableScale({
  onPress,
  children,
  className: cls = "",
}: {
  onPress: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      style={animatedStyle}
      className={cls}
    >
      {children}
    </AnimatedPressable>
  );
}

function GroupCard({
  group,
  index,
}: {
  group: GroupSummary;
  index: number;
}) {
  const router = useRouter();
  const colorIndex = hashId(group.id);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <PressableScale
        onPress={() => router.push(`/(app)/groups/${group.id}`)}
        className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
      >
        <GroupThumbnail emoji={group.emoji} colorIndex={colorIndex} />

        <View className="min-w-0 flex-1">
          <Text
            className="text-base font-semibold text-stone-900 dark:text-white"
            numberOfLines={1}
          >
            {group.name}
          </Text>
          <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            {group.memberCount}{" "}
            {group.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>

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
      </PressableScale>
    </Animated.View>
  );
}

function FriendCard({
  friend,
  index,
}: {
  friend: FriendInfo;
  index: number;
}) {
  const router = useRouter();
  const colorIndex = hashId(friend.groupId);
  const color = getGroupColor(colorIndex);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <PressableScale
        onPress={() => router.push(`/(app)/groups/${friend.groupId}`)}
        className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
      >
        {/* Circular colored avatar */}
        <View
          style={{ backgroundColor: color.bg }}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <Text className="text-lg">{friend.emoji ?? "🐦"}</Text>
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className="text-base font-semibold text-stone-900 dark:text-white"
            numberOfLines={1}
          >
            {formatDisplayName(friend.displayName)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          {friend.balanceCents !== 0 && (
            <View className="items-end">
              <Text
                className={`text-[11px] ${
                  friend.balanceCents > 0
                    ? "text-emerald-600/70 dark:text-emerald-400/70"
                    : "text-rose-600/70 dark:text-rose-400/70"
                }`}
              >
                {friend.balanceCents > 0 ? "you are owed" : "you owe"}
              </Text>
              <Text
                className={`text-sm font-semibold ${
                  friend.balanceCents > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatCents(Math.abs(friend.balanceCents))}
              </Text>
            </View>
          )}
          <ChevronRight size={16} color="#d6d3d1" />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: groups, isLoading, refetch } = useGroups();
  const { data: profile } = useCurrentUser();
  const { data: contacts } = useContacts();
  const [refreshing, setRefreshing] = useState(false);

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
        displayName: g.name,
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const hasContacts = (contacts ?? []).length > 0;

  const groupCount = regularGroups.length;
  const friendCount = friends.length;

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
        data={regularGroups}
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
            <Card className="mb-4 overflow-hidden">
              <View className="relative bg-amber-600 px-5 pb-5 pt-8 dark:bg-amber-700">
                {/* Bird watermark */}
                <Text className="absolute right-4 top-3 text-4xl opacity-15">
                  🪺
                </Text>

                <Text className="text-2xl font-bold tracking-tight text-white">
                  Hey {displayName}.
                </Text>
                {(groups ?? []).length > 0 && (
                  <Text className="mt-2 text-xl font-semibold text-white/95">
                    {totalBalance === 0
                      ? "You're all settled up!"
                      : totalBalance > 0
                        ? `You are owed ${formatCents(totalBalance)}`
                        : `You owe ${formatCents(Math.abs(totalBalance))}`}
                  </Text>
                )}
              </View>
            </Card>

            {/* Summary bar */}
            {(groups ?? []).length > 0 && (
              <Text className="mb-4 text-center text-xs text-stone-400 dark:text-stone-500">
                {groupCount} {groupCount === 1 ? "group" : "groups"}
                {friendCount > 0 &&
                  ` · ${friendCount} ${friendCount === 1 ? "friend" : "friends"}`}
              </Text>
            )}

            {/* Section header */}
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold tracking-tight text-stone-900 dark:text-white">
                Your groups
              </Text>
              <Pressable
                onPress={() =>
                  router.push("/(app)/(dashboard)/create-group")
                }
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
        renderItem={({ item, index }) => (
          <GroupCard group={item} index={index} />
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
            {(friends.length > 0 || hasContacts) && (
              <View className="mt-6">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-lg font-bold tracking-tight text-stone-900 dark:text-white">
                    Friends
                  </Text>
                  {hasContacts && (
                    <Pressable
                      onPress={() =>
                        router.push(
                          "/(app)/(dashboard)/add-friend-expense",
                        )
                      }
                      className="flex-row items-center gap-1 rounded-full bg-amber-600 px-3.5 py-1.5 dark:bg-amber-500"
                    >
                      <UserPlus size={12} color="#fff" strokeWidth={3} />
                      <Text className="text-xs font-semibold text-white">
                        Add expense
                      </Text>
                    </Pressable>
                  )}
                </View>

                {friends.length === 0 ? (
                  <Card className="items-center px-4 py-6">
                    <Text className="text-center text-sm text-stone-500 dark:text-stone-400">
                      Add an expense with a friend to start tracking debts
                      individually.
                    </Text>
                  </Card>
                ) : (
                  friends.map((friend, i) => (
                    <FriendCard
                      key={friend.groupId}
                      friend={friend}
                      index={i}
                    />
                  ))
                )}
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
