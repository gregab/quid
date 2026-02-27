import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Share,
  ImageBackground,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Settings,
  Plus,
  CheckCircle,
  Share as ShareIcon,
  Repeat,
  CirclePlus,
  Pencil,
  Trash2,
  XCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Receipt,
  UserPlus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useAuth } from "../../../../lib/auth";
import {
  useGroupDetail,
  useGroupExpenses,
  useActivityLogs,
} from "../../../../lib/queries";
import { useDeleteExpense } from "../../../../lib/queries/expenses";
import { Card } from "../../../../components/ui/Card";
import { MemberPill } from "../../../../components/ui/MemberPill";
import { GroupDetailSkeleton } from "../../../../components/ui/SkeletonLoader";
import { ErrorState } from "../../../../components/ui/ErrorState";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Sheet } from "../../../../components/ui/BottomSheet";
import {
  buildRawDebts,
  simplifyDebts,
  formatDisplayName,
  formatCents,
  UNKNOWN_USER,
  MEMBER_EMOJIS,
  getGroupColor,
} from "../../../../lib/queries/shared";
import type {
  ExpenseRow,
  Member,
  ResolvedDebt,
  ActivityLog,
} from "../../../../lib/types";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const ACTION_TITLES: Record<string, string> = {
  expense_added: "Expense added",
  expense_edited: "Expense edited",
  expense_deleted: "Expense deleted",
  payment_recorded: "Payment recorded",
  payment_deleted: "Payment deleted",
};

function DebtLine({
  debt,
  currentUserId,
}: {
  debt: ResolvedDebt;
  currentUserId: string;
}) {
  const isOwing = debt.fromId === currentUserId;
  const isReceiving = debt.toId === currentUserId;
  const fromName = isOwing ? "You" : debt.fromName;
  const toName = isReceiving ? "you" : debt.toName;
  const verb = isOwing ? "owe" : "owes";

  const dotColor = isOwing
    ? "bg-rose-400"
    : isReceiving
      ? "bg-emerald-400"
      : "bg-stone-300";

  const amountColor = isOwing
    ? "text-red-600 dark:text-red-400"
    : isReceiving
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-stone-500 dark:text-stone-400";

  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <View className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <Text className="min-w-0 flex-1 text-sm text-stone-500 dark:text-stone-400">
        <Text
          className={
            isOwing || isReceiving
              ? "text-stone-700 dark:text-stone-200"
              : ""
          }
        >
          {fromName}
        </Text>{" "}
        {verb}{" "}
        <Text
          className={
            isOwing || isReceiving
              ? "text-stone-700 dark:text-stone-200"
              : ""
          }
        >
          {toName}
        </Text>
      </Text>
      <Text className={`text-sm font-semibold ${amountColor}`}>
        {formatCents(debt.amountCents)}
      </Text>
    </View>
  );
}

function getExpenseBadge(
  expense: ExpenseRow,
  currentUserId: string,
): { bgColor: string; iconColor: string; Icon: React.ComponentType<{ size: number; color: string }> } {
  if (expense.isPayment) {
    const recipientSplit = expense.splits.find((s) => s.userId !== expense.paidById);
    if (expense.paidById === currentUserId) {
      return { bgColor: "#fef3c7", iconColor: "#d97706", Icon: ArrowUpRight };
    }
    if (recipientSplit?.userId === currentUserId) {
      return { bgColor: "#d1fae5", iconColor: "#059669", Icon: ArrowDownLeft };
    }
    return { bgColor: "#f5f5f4", iconColor: "#78716c", Icon: Receipt };
  }

  const mySplit = expense.splits.find((s) => s.userId === currentUserId);
  const amIPayer = expense.paidById === currentUserId;
  if (amIPayer && mySplit) {
    const lent = expense.amountCents - mySplit.amountCents;
    if (lent > 0) {
      return { bgColor: "#d1fae5", iconColor: "#059669", Icon: TrendingUp };
    }
  }
  if (!amIPayer && mySplit) {
    return { bgColor: "#ffe4e6", iconColor: "#f43f5e", Icon: TrendingDown };
  }
  return { bgColor: "#f5f5f4", iconColor: "#78716c", Icon: Receipt };
}

function ExpenseCard({
  expense,
  currentUserId,
  members,
  onPress,
}: {
  expense: ExpenseRow;
  currentUserId: string;
  members: Member[];
  onPress: () => void;
}) {
  const [year, month, day] = expense.date.split("-").map(Number);
  const dateObj = new Date(year!, month! - 1, day!);
  const monthStr = dateObj
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();

  let contextLabel: string | null = null;
  let contextPositive = false;
  if (!expense.isPayment) {
    const mySplit = expense.splits.find((s) => s.userId === currentUserId);
    const amIPayer = expense.paidById === currentUserId;
    if (amIPayer && mySplit) {
      const lent = expense.amountCents - mySplit.amountCents;
      if (lent > 0) {
        contextLabel = `you lent ${formatCents(lent)}`;
        contextPositive = true;
      }
    } else if (!amIPayer && mySplit) {
      contextLabel = `you owe ${formatCents(mySplit.amountCents)}`;
    }
  }

  let paymentDirection: string | null = null;
  if (expense.isPayment) {
    const recipientSplit = expense.splits.find((s) => s.userId !== expense.paidById);
    const toId = recipientSplit?.userId;
    const toMember = members.find((m) => m.userId === toId);
    const toName = toMember
      ? formatDisplayName(toMember.displayName)
      : UNKNOWN_USER;
    if (expense.paidById === currentUserId) {
      paymentDirection = `you paid ${toName}`;
    } else if (toId === currentUserId) {
      paymentDirection = `${formatDisplayName(expense.paidByDisplayName)} paid you`;
    } else {
      paymentDirection = `${formatDisplayName(expense.paidByDisplayName)} \u2192 ${toName}`;
    }
  }

  const badge = getExpenseBadge(expense, currentUserId);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-stone-100 py-3 active:opacity-80 dark:border-stone-800/60"
    >
      <View className="w-11 items-center rounded-lg bg-stone-100 py-1.5 dark:bg-stone-800">
        <Text className="text-[10px] font-bold uppercase text-stone-400 dark:text-stone-500">
          {monthStr}
        </Text>
        <Text className="text-lg font-bold leading-tight text-stone-700 dark:text-stone-300">
          {day}
        </Text>
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {expense.isPayment && (
            <ArrowDownLeft size={12} color="#16a34a" />
          )}
          <Text
            className="text-sm font-semibold text-stone-900 dark:text-white"
            numberOfLines={1}
          >
            {expense.isPayment ? "Payment" : expense.description}
          </Text>
          {expense.recurringExpense && (
            <Text className="text-xs text-amber-600 dark:text-amber-400" accessibilityLabel="Recurring">
              ↻
            </Text>
          )}
        </View>
        {paymentDirection && (
          <Text className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {paymentDirection}
          </Text>
        )}
        {contextLabel && (
          <Text
            className={`mt-0.5 text-xs font-medium ${
              contextPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500 dark:text-rose-400"
            }`}
          >
            {contextLabel}
          </Text>
        )}
        {!expense.isPayment && (
          <Text className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
            Paid by {formatDisplayName(expense.paidByDisplayName)}
          </Text>
        )}
      </View>

      <View className="items-end">
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: badge.bgColor,
            borderWidth: 1,
            borderColor: `${badge.iconColor}4D`,
          }}
          className="items-center justify-center"
          testID="expense-badge"
        >
          <badge.Icon size={16} color={badge.iconColor} />
        </View>
        <Text className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
          {formatCents(expense.amountCents)}
        </Text>
      </View>

      {expense.isPending && (
        <View className="h-2 w-2 rounded-full bg-amber-400" />
      )}
    </Pressable>
  );
}

function SwipeDeleteAction() {
  return (
    <View
      style={{
        backgroundColor: "#dc2626",
        justifyContent: "center",
        alignItems: "center",
        width: 80,
      }}
      testID="swipe-delete-action"
    >
      <Trash2 size={18} color="#ffffff" />
      <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
        Delete
      </Text>
    </View>
  );
}

function SwipeableExpenseRow({
  canDelete,
  onDelete,
  children,
}: {
  canDelete: boolean;
  onDelete: () => void;
  children: ReactNode;
}) {
  if (!canDelete) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={() => <SwipeDeleteAction />}
      onSwipeableOpen={(direction) => {
        if (direction === "right") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDelete();
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const ACTIVITY_ICON_CONFIG: Record<
  string,
  { Icon: React.ComponentType<{ size: number; color: string }>; color: string }
> = {
  expense_added: { Icon: CirclePlus, color: "#d97706" },
  expense_edited: { Icon: Pencil, color: "#78716c" },
  expense_deleted: { Icon: Trash2, color: "#e11d48" },
  payment_recorded: { Icon: CheckCircle, color: "#16a34a" },
  payment_deleted: { Icon: XCircle, color: "#e11d48" },
};

function ActivityItem({
  log,
  onPress,
}: {
  log: ActivityLog;
  onPress?: () => void;
}) {
  const title = ACTION_TITLES[log.action] ?? log.action;
  const payload = log.payload as Record<string, unknown> | null;
  const iconConfig = ACTIVITY_ICON_CONFIG[log.action];

  let detail: string | null = null;
  if (payload) {
    if (payload.description) {
      detail = `${payload.description}`;
      if (payload.amountCents) {
        detail += ` \u2014 ${formatCents(payload.amountCents as number)}`;
      }
    } else if (payload.amountCents) {
      detail = formatCents(payload.amountCents as number);
    }
  }

  const content = (
    <View className="flex-row items-start gap-3 py-2.5">
      <View className="mt-0.5" testID={`${log.action}-icon`}>
        {iconConfig ? (
          <iconConfig.Icon size={14} color={iconConfig.color} />
        ) : (
          <View className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-xs text-stone-500 dark:text-stone-400">
          <Text className="font-medium text-stone-700 dark:text-stone-300">
            {log.actor.displayName}
          </Text>
          {" \u2014 "}
          {title}
        </Text>
        {detail && (
          <Text
            className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500"
            numberOfLines={1}
          >
            {detail}
          </Text>
        )}
      </View>
      <Text className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
        {formatRelativeTime(String(log.createdAt))}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} testID={`activity-item-${log.id}`} className="active:opacity-80">
        {content}
      </Pressable>
    );
  }

  return content;
}

function ActivitySheetContent({
  activity,
  onClose,
}: {
  activity: ActivityLog;
  onClose: () => void;
}) {
  const title = ACTION_TITLES[activity.action] ?? activity.action;
  const payload = activity.payload as Record<string, unknown> | null;

  const rows: Array<{ label: string; value: string }> = [];

  if (payload) {
    if (payload.description) {
      rows.push({ label: "Description", value: String(payload.description) });
    }
    if (payload.amountCents != null) {
      rows.push({ label: "Amount", value: formatCents(payload.amountCents as number) });
    }
    if (payload.fromDisplayName) {
      rows.push({ label: "From", value: String(payload.fromDisplayName) });
    }
    if (payload.toDisplayName) {
      rows.push({ label: "To", value: String(payload.toDisplayName) });
    }
    if (payload.paidByDisplayName) {
      rows.push({ label: "Paid by", value: String(payload.paidByDisplayName) });
    }
  }

  return (
    <ScrollView testID="activity-sheet-content">
      {/* Action title */}
      <Text className="text-base font-semibold text-stone-900 dark:text-white">
        {title}
      </Text>

      {/* Divider */}
      <View className="my-3 h-px bg-stone-100 dark:bg-stone-800" />

      {/* Section header */}
      {rows.length > 0 && (
        <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
          Details
        </Text>
      )}

      {rows.length > 0 ? (
        <View className="mb-6 gap-3">
          {rows.map((row) => (
            <View key={row.label} className="flex-row items-center justify-between">
              <Text className="text-sm text-stone-500 dark:text-stone-400">
                {row.label}
              </Text>
              <Text className="text-sm font-medium text-stone-900 dark:text-stone-100">
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="mb-6 text-sm text-stone-400 dark:text-stone-500">
          No additional details.
        </Text>
      )}

      {/* Footer — actor name in amber accent */}
      <Text className="mb-5 text-xs text-stone-400 dark:text-stone-500">
        By{" "}
        <Text className="font-medium text-amber-600 dark:text-amber-400">
          {activity.actor.displayName}
        </Text>
        {" · "}
        {formatRelativeTime(String(activity.createdAt))}
      </Text>

      {/* Close button — full-width ghost style */}
      <Pressable
        onPress={onClose}
        className="items-center rounded-xl border border-stone-200 py-3 active:opacity-80 dark:border-stone-700"
      >
        <Text className="text-sm font-semibold text-stone-600 dark:text-stone-400">
          Close
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function GroupBannerHeader({
  group,
  displayTitle,
  isFriendGroup,
  groupId,
}: {
  group: Record<string, unknown>;
  displayTitle: string;
  isFriendGroup: boolean;
  groupId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bannerUrl = group.bannerUrl as string | null;
  const emoji = group.emoji as string | null;
  const patternSeed = (group.patternSeed as number | null) ?? 0;
  const groupColor = getGroupColor(patternSeed);

  const headerContent = (
    <>
      {/* Full overlay for depth */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)" }}
      />

      {/* Bottom gradient zone for name legibility */}
      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 60, backgroundColor: "rgba(0,0,0,0.45)" }}
      />

      {/* Back button — pill style for visibility on any color */}
      <Pressable
        onPress={() => router.back()}
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(0,0,0,0.3)",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="active:opacity-70"
        testID="banner-back"
      >
        <ChevronLeft size={22} color="#ffffff" />
      </Pressable>

      {/* Settings gear — same pill style as back button */}
      {!isFriendGroup && (
        <Pressable
          onPress={() => router.push(`/(app)/groups/${groupId}/settings`)}
          style={{
            position: "absolute",
            top: insets.top + 8,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "rgba(0,0,0,0.3)",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="active:opacity-70"
        >
          <Settings size={18} color="#ffffff" />
        </Pressable>
      )}

      {/* Emoji — slightly elevated from center */}
      {emoji && (
        <View style={{ position: "absolute", top: "35%", left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ fontSize: 52 }}>{emoji}</Text>
        </View>
      )}

      {/* Group name — bottom-left with letter spacing */}
      <Text
        style={{ position: "absolute", bottom: 12, left: 16, right: 16, letterSpacing: 0.3, fontSize: 18, fontWeight: "700", color: "#ffffff" }}
        numberOfLines={1}
      >
        {displayTitle}
      </Text>
    </>
  );

  if (bannerUrl) {
    return (
      <View style={{ height: 160, overflow: "hidden" }}>
        <ImageBackground
          source={{ uri: bannerUrl }}
          style={{ flex: 1 }}
          testID="banner-image"
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}>
            {headerContent}
          </View>
        </ImageBackground>
        {/* Accent border */}
        <View style={{ height: 3, backgroundColor: groupColor.accent }} />
      </View>
    );
  }

  return (
    <View style={{ height: 160, overflow: "hidden" }} testID="banner-color">
      <View style={{ flex: 1, backgroundColor: groupColor.bg }}>
        {headerContent}
      </View>
      {/* Accent border — crisp termination line */}
      <View style={{ height: 3, backgroundColor: groupColor.accent }} />
    </View>
  );
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { data: group, isLoading: groupLoading, isError: groupError, refetch: refetchGroup } = useGroupDetail(id!);
  const {
    data: expenses,
    isLoading: expensesLoading,
    isError: expensesError,
    refetch: refetchExpenses,
  } = useGroupExpenses(id!);
  const {
    data: activityPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchActivity,
  } = useActivityLogs(id!);

  const deleteExpense = useDeleteExpense(id!);

  const [refreshing, setRefreshing] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [showAllDebts, setShowAllDebts] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);
  const activitySheetRef = useRef<BottomSheetModal>(null);

  // Gentle float animation for the Add expense button
  const addFloatY = useSharedValue(0);
  useEffect(() => {
    addFloatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [addFloatY]);
  const addFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: addFloatY.value }],
  }));

  const members: Member[] = useMemo(() => {
    if (!group) return [];
    const gm = (group as Record<string, unknown>).GroupMember as
      | Array<Record<string, unknown>>
      | null;
    return (gm ?? []).map((m, i) => {
      const u = m.User as Record<string, unknown> | null;
      return {
        userId: m.userId as string,
        displayName: (u?.displayName as string) ?? UNKNOWN_USER,
        emoji: MEMBER_EMOJIS[i % MEMBER_EMOJIS.length],
        avatarUrl: (u?.avatarUrl as string) ?? null,
      };
    });
  }, [group]);

  const inviteToken = (group as Record<string, unknown> | undefined)
    ?.inviteToken as string | undefined;

  const resolvedDebts: ResolvedDebt[] = useMemo(() => {
    if (!expenses || !user) return [];
    const simplified = simplifyDebts(buildRawDebts(expenses));
    const nameMap = new Map(members.map((m) => [m.userId, m.displayName]));
    const debts = simplified.map((d) => ({
      fromId: d.from,
      fromName: formatDisplayName(nameMap.get(d.from) ?? UNKNOWN_USER),
      toId: d.to,
      toName: formatDisplayName(nameMap.get(d.to) ?? UNKNOWN_USER),
      amountCents: d.amount,
    }));
    return [...debts].sort((a, b) => {
      const aMe = a.fromId === user.id || a.toId === user.id;
      const bMe = b.fromId === user.id || b.toId === user.id;
      if (aMe && !bMe) return -1;
      if (!aMe && bMe) return 1;
      return 0;
    });
  }, [expenses, members, user]);

  const userDebts = resolvedDebts.filter(
    (d) => d.fromId === user?.id || d.toId === user?.id,
  );
  const otherDebts = resolvedDebts.filter(
    (d) => d.fromId !== user?.id && d.toId !== user?.id,
  );

  const netBalance = useMemo(() => {
    let total = 0;
    for (const d of resolvedDebts) {
      if (d.toId === user?.id) total += d.amountCents;
      if (d.fromId === user?.id) total -= d.amountCents;
    }
    return total;
  }, [resolvedDebts, user]);

  const activityLogs = useMemo(
    () => (activityPages?.pages ?? []).flat(),
    [activityPages],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchGroup(), refetchExpenses(), refetchActivity()]);
    setRefreshing(false);
  };

  const handleCelebration = useCallback((name: string) => {
    setCelebration(name);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCelebration(null), 3000);
  }, []);

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

  const handleDeleteExpense = useCallback(
    (expense: ExpenseRow) => {
      const label = expense.isPayment ? "payment" : `"${expense.description}"`;
      Alert.alert(
        "Delete expense",
        `Are you sure you want to delete ${label}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              const participantNames = expense.splits.map((s) => {
                const m = members.find((mem) => mem.userId === s.userId);
                return m ? m.displayName : UNKNOWN_USER;
              });
              deleteExpense.mutate({
                expenseId: expense.id,
                description: expense.description,
                amountCents: expense.amountCents,
                paidByDisplayName: expense.paidByDisplayName,
                date: expense.date,
                participantDisplayNames: participantNames,
              });
            },
          },
        ],
      );
    },
    [deleteExpense, members],
  );

  const handleActivityPress = useCallback((log: ActivityLog) => {
    setSelectedActivity(log);
    activitySheetRef.current?.present();
  }, []);

  const handleActivitySheetClose = useCallback(() => {
    activitySheetRef.current?.dismiss();
    setSelectedActivity(null);
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      if (distanceFromBottom < 200 && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  if (groupLoading || expensesLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <GroupDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (groupError || expensesError) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 justify-center">
          <ErrorState
            message="Couldn't load this group. Check your connection and try again."
            onRetry={() => {
              void refetchGroup();
              void refetchExpenses();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 items-center justify-center">
          <Text className="text-stone-500">Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupName = (group as Record<string, unknown>).name as string;
  const isFriendGroup = ((group as Record<string, unknown>).isFriendGroup as boolean) ?? false;

  const friendDisplayName = isFriendGroup
    ? (() => {
        const gm = (group as Record<string, unknown>).GroupMember as Array<Record<string, unknown>> | null;
        const friend = (gm ?? []).find((m) => m.userId !== user?.id);
        const u = friend?.User as Record<string, unknown> | null;
        return (u?.displayName as string) ?? groupName;
      })()
    : groupName;

  const displayTitle = isFriendGroup ? friendDisplayName : groupName;

  const accentColor =
    netBalance < 0
      ? "bg-rose-400"
      : netBalance > 0
        ? "bg-emerald-400"
        : "bg-stone-300 dark:bg-stone-600";

  const balanceLabel =
    resolvedDebts.length === 0
      ? "All settled up"
      : netBalance > 0
        ? `You're owed ${formatCents(netBalance)}`
        : netBalance < 0
          ? `You owe ${formatCents(Math.abs(netBalance))}`
          : "You're all settled up";

  const balanceColor =
    netBalance > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : netBalance < 0
        ? "text-rose-500 dark:text-rose-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <View className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <GroupBannerHeader
        group={group as Record<string, unknown>}
        displayTitle={displayTitle}
        isFriendGroup={isFriendGroup}
        groupId={id!}
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />
        }
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {!isFriendGroup && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 pb-4 pt-3"
            contentContainerStyle={{ gap: 8 }}
          >
            {members.map((m) => (
              <MemberPill
                key={m.userId}
                emoji={m.emoji ?? "🐦"}
                displayName={formatDisplayName(m.displayName)}
                isCurrentUser={m.userId === user?.id}
              />
            ))}
            {inviteToken && (
              <Pressable
                onPress={handleShareInvite}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: "#fcd34d",
                  backgroundColor: "#fef9e7",
                }}
                className="active:opacity-70"
              >
                <UserPlus size={12} color="#d97706" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#92400e" }}>
                  Invite members
                </Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        {celebration && (
          <View className="mx-4 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
            <Text className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Settled up with {celebration}!
            </Text>
          </View>
        )}

        <View className="px-4 pb-4">
          <Card className="flex-row overflow-hidden">
            <View className={`w-1 rounded-l-xl ${accentColor}`} />
            <View className="min-w-0 flex-1 px-4 py-3">
              <View className="flex-row items-center gap-1.5">
                {resolvedDebts.length === 0 && (
                  <CheckCircle size={16} color="#16a34a" />
                )}
                <Text className={`text-xl font-bold ${balanceColor}`}>
                  {balanceLabel}
                </Text>
              </View>
              {userDebts.length > 0 && (
                <View className="mt-2">
                  {userDebts.map((d, i) => (
                    <DebtLine key={i} debt={d} currentUserId={user!.id} />
                  ))}
                </View>
              )}
              {showAllDebts &&
                otherDebts.map((d, i) => (
                  <DebtLine key={`o${i}`} debt={d} currentUserId={user!.id} />
                ))}
              {otherDebts.length > 0 && (
                <Pressable onPress={() => setShowAllDebts((v) => !v)}>
                  <Text className="mt-1 text-xs font-medium text-stone-400 dark:text-stone-500">
                    {showAllDebts
                      ? "Show less"
                      : `Show all balances (${otherDebts.length} more)`}
                  </Text>
                </Pressable>
              )}
              {resolvedDebts.length > 0 && (
                <Pressable
                  onPress={() => router.push(`/(app)/groups/${id}/record-payment`)}
                  className="mt-3 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 active:opacity-80 dark:border-emerald-700/40 dark:bg-emerald-900/30"
                >
                  <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Settle up
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>
        </View>

        <View className="px-4 pb-4">
          <Text className="mb-3 text-lg font-bold tracking-tight text-stone-900 dark:text-white">
            Expenses
          </Text>

          {(expenses ?? []).length === 0 ? (
            <EmptyState
              icon={<Receipt size={28} color="#d97706" />}
              title="No expenses yet"
              subtitle="Add the first expense to start tracking who owes what"
              action={{
                label: "Add expense",
                onPress: () => router.push(`/(app)/groups/${id}/add-expense`),
              }}
            />
          ) : (
            (expenses ?? []).map((expense) => (
              <SwipeableExpenseRow
                key={expense.id}
                canDelete={expense.canDelete}
                onDelete={() => handleDeleteExpense(expense)}
              >
                <ExpenseCard
                  expense={expense}
                  currentUserId={user!.id}
                  members={members}
                  onPress={() => router.push(`/(app)/groups/${id}/expense/${expense.id}`)}
                />
              </SwipeableExpenseRow>
            ))
          )}
        </View>

        <View className="px-4 pb-4">
          <Text className="mb-3 text-lg font-bold tracking-tight text-stone-900 dark:text-white">
            Activity
          </Text>
          {activityLogs.length === 0 ? (
            <Text className="text-sm text-stone-400 dark:text-stone-500">
              No activity yet.
            </Text>
          ) : (
            <>
              {activityLogs.map((log) => (
                <ActivityItem
                  key={log.id}
                  log={log}
                  onPress={() => handleActivityPress(log)}
                />
              ))}
              {isFetchingNextPage && (
                <View className="items-center py-3">
                  <ActivityIndicator size="small" color="#d97706" />
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating action island */}
      <View
        className="absolute left-4 right-4 flex-row items-center gap-2 rounded-3xl bg-white px-2.5 py-2 dark:bg-stone-900"
        style={{
          bottom: insets.bottom + 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.13,
          shadowRadius: 22,
          elevation: 14,
        }}
      >
        {!isFriendGroup && (
          <Pressable
            onPress={() => router.push(`/(app)/groups/${id}/recurring`)}
            className="flex-row items-center gap-1.5 rounded-full bg-stone-100 px-3.5 py-2.5 active:opacity-70 dark:bg-stone-800"
          >
            <Repeat size={13} color="#78716c" />
            <Text className="text-[12px] font-semibold text-stone-500 dark:text-stone-400">
              Recurring
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push(`/(app)/groups/${id}/record-payment`)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-2.5 active:opacity-80 dark:border-emerald-700/50 dark:bg-emerald-950/40"
        >
          <CheckCircle size={14} color="#16a34a" />
          <Text className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
            Settle up
          </Text>
        </Pressable>

        <Animated.View style={addFloatStyle}>
          <Pressable
            onPress={() => router.push(`/(app)/groups/${id}/add-expense`)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 24,
              backgroundColor: "#d97706",
              shadowColor: "#d97706",
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Plus size={15} color="#fff" strokeWidth={3} />
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff", letterSpacing: 0.2 }}>
              Add
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <Sheet ref={activitySheetRef} snapPoints={["50%", "85%"]}>
        {selectedActivity && (
          <ActivitySheetContent
            activity={selectedActivity}
            onClose={handleActivitySheetClose}
          />
        )}
      </Sheet>
    </View>
  );
}
