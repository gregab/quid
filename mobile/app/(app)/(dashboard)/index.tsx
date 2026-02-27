import { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ImageBackground,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Plus, Settings } from "lucide-react-native";
import { PressableRow } from "../../../components/ui/PressableRow";
import { useAuth } from "../../../lib/auth";
import { useGroups, useCurrentUser, useContacts } from "../../../lib/queries";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { DashboardSkeleton } from "../../../components/ui/SkeletonLoader";
import { ErrorState } from "../../../components/ui/ErrorState";
import { GroupThumbnail } from "../../../components/ui/GroupThumbnail";
import { Avatar } from "../../../components/ui/Avatar";
import { formatCents, BIRD_FACTS, formatDisplayName } from "../../../lib/queries/shared";
import type { GroupSummary } from "../../../lib/types";
import birdsImage from "../../../assets/birds.jpg";

interface FriendInfo {
  userId: string;
  displayName: string;
  emoji: string | null;
  avatarUrl: string | null;
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
    <PressableRow
      onPress={() => router.push(`/(app)/groups/${group.id}`)}
      className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
    >
      {/* Thumbnail */}
      <GroupThumbnail patternSeed={group.patternSeed} bannerUrl={group.bannerUrl} />

      {/* Group info */}
      <View className="min-w-0 flex-1">
        <Text
          className="text-[17px] font-semibold text-stone-900 dark:text-white"
          numberOfLines={1}
        >
          {group.name}
        </Text>
        <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          {" · "}
          {monthLabel}
        </Text>
      </View>

      {/* Balance */}
      <View className="flex-row items-center gap-1.5">
        {group.balanceCents === 0 ? (
          <Text className="text-xs font-medium text-stone-400 dark:text-stone-500">
            settled
          </Text>
        ) : (
          <View className="items-end">
            <Text
              className={`text-xs ${
                group.balanceCents > 0
                  ? "text-emerald-600/70 dark:text-emerald-400/70"
                  : "text-rose-500/70 dark:text-rose-400/70"
              }`}
            >
              {group.balanceCents > 0 ? "you are owed" : "you owe"}
            </Text>
            <Text
              className={`text-[15px] font-bold ${
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
    </PressableRow>
  );
}

function FriendCard({ friend }: { friend: FriendInfo }) {
  const router = useRouter();

  return (
    <PressableRow
      onPress={() => router.push(`/(app)/groups/${friend.groupId}`)}
      className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
    >
      {/* Avatar */}
      <Avatar
        imageUrl={friend.avatarUrl}
        emoji={friend.emoji ?? undefined}
        size="lg"
      />

      {/* Name */}
      <View className="min-w-0 flex-1">
        <Text
          className="text-[17px] font-semibold text-stone-900 dark:text-white"
          numberOfLines={1}
        >
          {formatDisplayName(friend.displayName)}
        </Text>
      </View>

      {/* Balance */}
      <View className="flex-row items-center gap-1.5">
        {friend.balanceCents === 0 ? (
          <Text className="text-xs font-medium text-stone-400 dark:text-stone-500">
            settled
          </Text>
        ) : (
          <View className="items-end">
            <Text
              className={`text-xs ${
                friend.balanceCents > 0
                  ? "text-emerald-600/70 dark:text-emerald-400/70"
                  : "text-rose-500/70 dark:text-rose-400/70"
              }`}
            >
              {friend.balanceCents > 0 ? "you are owed" : "you owe"}
            </Text>
            <Text
              className={`text-[15px] font-bold ${
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
    </PressableRow>
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
  const insets = useSafeAreaInsets();

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
        emoji: g.friendDefaultEmoji ?? g.emoji,
        avatarUrl: g.friendAvatarUrl ?? null,
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

  const hasGroups = (groups ?? []).length > 0;

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

            {/* Hero card — birds.jpg background */}
            <ImageBackground
              source={birdsImage}
              style={styles.heroBg}
              imageStyle={styles.heroBgImage}
            >
              {/* Dark gradient overlay — fades from semi-transparent at top to dark at bottom */}
              <LinearGradient
                colors={["rgba(0,0,0,0.20)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.70)"]}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>YOUR BALANCE</Text>
                <Text style={styles.heroGreeting}>Hey {displayName}.</Text>
                {(groups ?? []).length > 0 && (
                  <Text style={styles.heroBalance}>
                    {totalBalance === 0
                      ? "You're all settled up 🎉"
                      : totalBalance > 0
                        ? `You are owed ${formatCents(totalBalance)}`
                        : `You owe ${formatCents(Math.abs(totalBalance))}`}
                  </Text>
                )}
              </View>
            </ImageBackground>

            {/* Section header */}
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-stone-900 dark:text-white">
                Your groups
              </Text>
              <Pressable
                onPress={() => router.push("/(app)/(dashboard)/create-group")}
                className="flex-row items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 active:opacity-80 dark:border-amber-700 dark:bg-amber-900/30"
              >
                <Plus size={13} color="#92400e" strokeWidth={2.5} />
                <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300">
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
                <View className="mb-3 flex-row items-center">
                  <Text className="text-xl font-bold text-stone-900 dark:text-white">
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

      {/* FAB — Add expense — only when groups exist */}
      {hasGroups && (
        <Pressable
          onPress={() => router.push("/(app)/(dashboard)/add-expense-picker")}
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          accessibilityLabel="Add expense"
          accessibilityRole="button"
        >
          <Plus size={26} color="#fff" strokeWidth={2.5} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroBg: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  heroBgImage: {
    borderRadius: 16,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  heroGreeting: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroBalance: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.88)",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#d97706",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
