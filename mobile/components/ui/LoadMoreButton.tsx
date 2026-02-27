import { Pressable, Text, ActivityIndicator, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

interface LoadMoreButtonProps {
  onPress: () => void;
  loading?: boolean;
  label?: string;
}

/** Subtle "Load more" control for paginated lists. Animates in on mount. */
export function LoadMoreButton({
  onPress,
  loading = false,
  label = "Load more",
}: LoadMoreButtonProps) {
  return (
    <Animated.View entering={FadeIn.duration(250)} testID="load-more-wrapper">
      <Pressable
        onPress={onPress}
        disabled={loading}
        className="mt-3 items-center rounded-xl border border-stone-200 bg-stone-50 py-2.5 active:bg-amber-50 active:border-amber-200 dark:border-stone-700/60 dark:bg-stone-800/40 dark:active:bg-amber-950/30 dark:active:border-amber-700/40"
        testID="load-more-button"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#d97706" testID="load-more-spinner" />
        ) : (
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs font-semibold tracking-wide text-stone-400 dark:text-stone-500">
              {label}
            </Text>
            <Text className="text-[10px] text-stone-300 dark:text-stone-600">
              {"▼"}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
