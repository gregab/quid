import { View, Text, Pressable } from "react-native";
import type { ReactNode } from "react";
import { Card } from "./Card";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <Card className="items-center px-5 py-10">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
        {icon}
      </View>
      <Text className="mb-1.5 text-center text-lg font-bold text-stone-800 dark:text-stone-200">
        {title}
      </Text>
      {subtitle && (
        <Text className="mb-4 text-center text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          {subtitle}
        </Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          className="rounded-xl bg-amber-600 px-6 py-3 dark:bg-amber-500"
          accessibilityRole="button"
        >
          <Text className="font-semibold text-white">{action.label}</Text>
        </Pressable>
      )}
    </Card>
  );
}
