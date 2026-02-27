import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import type { ReactNode } from "react";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableRowProps {
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

/**
 * A lightweight pressable wrapper with subtle scale + opacity feedback.
 * Use for tappable rows, cards, and list items — lighter than Button's
 * spring animation (scale 0.99 vs 0.97).
 */
export function PressableRow({
  onPress,
  children,
  disabled = false,
  className = "",
  testID,
}: PressableRowProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.99, { damping: 15, stiffness: 400 });
    opacity.value = withSpring(0.85, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      style={animatedStyle}
      className={className}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}
