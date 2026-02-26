import { useEffect } from "react";
import { Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { CheckCircle, XCircle, Info } from "lucide-react-native";
import type { ToastType } from "../../lib/toast";

const TOAST_CONFIG: Record<
  ToastType,
  {
    containerClass: string;
    textClass: string;
    iconColor: string;
    Icon: typeof CheckCircle;
  }
> = {
  success: {
    containerClass:
      "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800",
    textClass: "text-emerald-700 dark:text-emerald-300",
    iconColor: "#15803d",
    Icon: CheckCircle,
  },
  error: {
    containerClass:
      "bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800",
    textClass: "text-rose-700 dark:text-rose-300",
    iconColor: "#be123c",
    Icon: XCircle,
  },
  info: {
    containerClass:
      "bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800",
    textClass: "text-amber-700 dark:text-amber-300",
    iconColor: "#b45309",
    Icon: Info,
  },
};

interface ToastProps {
  message: string;
  type: ToastType;
  duration: number;
  onDismiss: () => void;
}

export function Toast({ message, type, duration, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();
  const config = TOAST_CONFIG[type];
  const { Icon } = config;

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={{ top: insets.top + 8, position: "absolute", left: 0, right: 0, zIndex: 9999 }}
      className="mx-4"
      testID="toast"
    >
      <Pressable
        onPress={onDismiss}
        className={`flex-row items-center gap-2.5 rounded-xl border px-4 py-3 shadow-md ${config.containerClass}`}
      >
        <Icon size={18} color={config.iconColor} />
        <Text
          className={`flex-1 text-sm font-medium ${config.textClass}`}
          numberOfLines={2}
        >
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
