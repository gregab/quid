import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="font-serif-logo text-2xl text-amber-600 dark:text-amber-500">
          Aviary
        </Text>
        <Text className="text-5xl">🐦</Text>
        <Text className="text-lg font-semibold text-stone-800 dark:text-stone-100">
          Looks like this nest is empty
        </Text>
        <Text className="text-center text-sm text-stone-500 dark:text-stone-400">
          We couldn't find the page you were looking for.
        </Text>
        <Pressable
          testID="back-to-dashboard"
          onPress={() => router.replace("/(app)/(dashboard)")}
          className="mt-2 rounded-xl bg-amber-600 px-6 py-3"
        >
          <Text className="font-semibold text-white">Go to dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
