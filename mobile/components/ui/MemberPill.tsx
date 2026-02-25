import { View, Text } from "react-native";

interface MemberPillProps {
  emoji: string;
  displayName: string;
  isCurrentUser?: boolean;
}

export function MemberPill({
  emoji,
  displayName,
  isCurrentUser = false,
}: MemberPillProps) {
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
        isCurrentUser
          ? "bg-amber-100 dark:bg-amber-900/30"
          : "bg-stone-100 dark:bg-stone-800"
      }`}
    >
      <Text className="text-sm">{emoji}</Text>
      <Text
        className={`text-xs font-medium ${
          isCurrentUser
            ? "text-amber-800 dark:text-amber-200"
            : "text-stone-700 dark:text-stone-300"
        }`}
        numberOfLines={1}
      >
        {displayName}
      </Text>
    </View>
  );
}
