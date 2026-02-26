import { View, Text, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: ScreenHeaderProps) {
  return (
    <View className="border-b border-stone-100 px-4 pb-2.5 pt-1 dark:border-stone-800/60">
      <View className="flex-row items-center justify-between">
        {/* Left */}
        <View className="min-w-[60px]">
          {onBack ? (
            <Pressable
              onPress={onBack}
              className="flex-row items-center gap-0.5"
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ChevronLeft size={20} color="#78716c" />
              <Text className="text-sm text-stone-500">Back</Text>
            </Pressable>
          ) : (
            <Text className="text-lg font-normal italic text-stone-800 dark:text-stone-200">
              Aviary
            </Text>
          )}
        </View>

        {/* Center */}
        {title ? (
          <View className="mx-2 min-w-0 flex-1 items-center">
            <Text
              className="text-sm font-semibold text-stone-900 dark:text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                className="text-xs text-stone-500 dark:text-stone-400"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="flex-1" />
        )}

        {/* Right */}
        <View className="min-w-[60px] items-end">
          {rightAction ?? null}
        </View>
      </View>
    </View>
  );
}
