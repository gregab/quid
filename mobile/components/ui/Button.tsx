import { Pressable, Text, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress: () => void;
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const variantStyles: Record<
  ButtonVariant,
  { container: string; text: string; loader: string }
> = {
  primary: {
    container: "bg-amber-600 dark:bg-amber-500 shadow-sm",
    text: "text-white",
    loader: "#ffffff",
  },
  secondary: {
    container:
      "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm",
    text: "text-stone-800 dark:text-stone-200",
    loader: "#78716c",
  },
  ghost: {
    container:
      "bg-transparent border border-stone-200 dark:border-stone-700",
    text: "text-stone-600 dark:text-stone-400",
    loader: "#78716c",
  },
  danger: {
    container: "bg-red-600 dark:bg-red-500 shadow-sm",
    text: "text-white",
    loader: "#ffffff",
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  sm: { container: "px-3 py-2 rounded-lg", text: "text-xs" },
  md: { container: "px-4 py-3 rounded-xl", text: "text-sm" },
  lg: { container: "px-5 py-3.5 rounded-xl", text: "text-base" },
};

export function Button({
  variant = "primary",
  size = "md",
  onPress,
  children,
  loading = false,
  disabled = false,
  className = "",
}: ButtonProps) {
  const scale = useSharedValue(1);
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    if (loading || disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      style={animatedStyle}
      className={`flex-row items-center justify-center ${sizes.container} ${styles.container} ${disabled ? "opacity-50" : ""} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={styles.loader} size="small" />
      ) : typeof children === "string" ? (
        <Text className={`font-semibold ${sizes.text} ${styles.text}`}>
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}
