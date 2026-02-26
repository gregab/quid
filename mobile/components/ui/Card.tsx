import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import type { ReactNode } from "react";

type CardVariant = "default" | "flat" | "elevated";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  pressable?: boolean;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variantStyles: Record<CardVariant, string> = {
  default:
    "rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900",
  flat: "rounded-xl bg-white dark:bg-stone-900",
  elevated:
    "rounded-xl border border-stone-200 bg-white shadow-md dark:border-stone-800 dark:bg-stone-900",
};

export function Card({
  children,
  className = "",
  variant = "default",
  pressable = false,
  onPress,
}: CardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  if (pressable) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={animatedStyle}
        className={`${variantStyles[variant]} ${className}`}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View className={`${variantStyles[variant]} ${className}`}>
      {children}
    </View>
  );
}
