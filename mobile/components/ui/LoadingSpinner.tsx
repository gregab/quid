import { View, Text, ActivityIndicator } from "react-native";

interface LoadingSpinnerProps {
  text?: string;
  size?: "small" | "large";
}

export function LoadingSpinner({
  text,
  size = "large",
}: LoadingSpinnerProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator size={size} color="#d97706" />
      {text && (
        <Text className="text-sm text-stone-500 dark:text-stone-400">
          {text}
        </Text>
      )}
    </View>
  );
}
