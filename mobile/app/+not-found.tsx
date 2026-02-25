import { View, Text } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotFoundScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <View className="flex-1 items-center justify-center gap-4 px-4">
        <Text className="text-4xl">🔍</Text>
        <Text className="text-lg font-semibold text-stone-800 dark:text-stone-100">
          Page not found
        </Text>
        <Link href="/(app)/(dashboard)">
          <Text className="text-sm font-semibold text-amber-600 dark:text-amber-500">
            Go to dashboard
          </Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
