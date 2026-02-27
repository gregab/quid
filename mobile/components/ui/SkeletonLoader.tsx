import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

/**
 * Animated shimmer block that pulses between stone-100 and stone-200.
 * Uses NativeWind for base styling, reanimated for the opacity loop.
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className={`rounded-lg bg-stone-200 dark:bg-stone-700 ${className}`}
    />
  );
}

/** Mimics 4 group cards: thumbnail + 2 text lines per row. */
export function DashboardSkeleton() {
  return (
    <View className="px-4 pt-4" testID="dashboard-skeleton">
      {/* Header placeholder */}
      <View className="mb-4 mt-2 flex-row items-center justify-between">
        <SkeletonBlock className="h-7 w-20" />
        <SkeletonBlock className="h-6 w-6 rounded-full" />
      </View>

      {/* Hero card placeholder */}
      <SkeletonBlock className="mb-6 h-28 rounded-xl" />

      {/* Section header */}
      <View className="mb-3 flex-row items-center justify-between">
        <SkeletonBlock className="h-5 w-28" />
        <SkeletonBlock className="h-7 w-24 rounded-full" />
      </View>

      {/* 4 group card rows */}
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
        >
          <SkeletonBlock className="h-11 w-11 rounded-lg" />
          <View className="min-w-0 flex-1 gap-2">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-20" />
          </View>
          <SkeletonBlock className="h-4 w-14" />
        </View>
      ))}
    </View>
  );
}

/** Mimics the group detail header, balance card, tabs, and expense rows. */
export function GroupDetailSkeleton() {
  return (
    <View className="flex-1" testID="group-detail-skeleton">
      {/* Banner header area */}
      <View className="px-4 pb-4 pt-2">
        {/* Back + settings row */}
        <View className="mb-3 flex-row items-center justify-between">
          <SkeletonBlock className="h-5 w-14" />
          <SkeletonBlock className="h-6 w-6 rounded-full" />
        </View>

        {/* Title */}
        <SkeletonBlock className="mb-4 h-7 w-44" />

        {/* Member pills */}
        <View className="mb-4 flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-8 w-20 rounded-full" />
          ))}
        </View>

        {/* Balance card */}
        <SkeletonBlock className="mb-5 h-24 rounded-xl" />

        {/* Tab bar */}
        <View className="flex-row gap-6">
          <SkeletonBlock className="h-5 w-20" />
          <SkeletonBlock className="h-5 w-16" />
          <SkeletonBlock className="h-5 w-14" />
        </View>
      </View>

      {/* Expense rows */}
      <View className="px-4">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="flex-row items-center gap-3 border-b border-stone-100 py-3.5 dark:border-stone-800/60"
          >
            <SkeletonBlock className="h-10 w-10 rounded-lg" />
            <View className="min-w-0 flex-1 gap-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-3 w-24" />
            </View>
            <SkeletonBlock className="h-4 w-14" />
          </View>
        ))}
      </View>
    </View>
  );
}
