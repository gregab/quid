import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useNetworkStatus } from "../../lib/useNetworkStatus";

/**
 * Slim offline banner that slides down from the top when network is unavailable.
 * Uses Aviary's warm amber/stone palette: amber-700 background with amber-100 text.
 */
export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const translateY = useSharedValue(-60);

  useEffect(() => {
    translateY.value = withTiming(isConnected ? -60 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [isConnected, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={{
          backgroundColor: "#b45309",
          paddingVertical: 8,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Text
          style={{
            color: "#fef3c7",
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          ●
        </Text>
        <Text
          style={{
            color: "#fef3c7",
            fontSize: 13,
            fontWeight: "600",
            letterSpacing: 0.2,
          }}
        >
          No internet connection
        </Text>
      </View>
    </Animated.View>
  );
}
