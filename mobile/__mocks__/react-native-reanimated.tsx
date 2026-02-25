/**
 * Mock for react-native-reanimated.
 */
import { forwardRef, type ReactNode } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any> & { children?: ReactNode };

export function useSharedValue<T>(initialValue: T) {
  return { value: initialValue };
}

export function useAnimatedStyle(updater: () => Record<string, unknown>) {
  return updater();
}

export function withSpring(toValue: number) { return toValue; }
export function withTiming(toValue: number) { return toValue; }
export function withDelay(_delay: number, animation: unknown) { return animation; }
export function withSequence(...animations: unknown[]) { return animations[animations.length - 1]; }
export function runOnJS<T extends (...args: unknown[]) => unknown>(fn: T): T { return fn; }
export function createAnimatedComponent<T>(component: T): T { return component; }

const AnimatedView = forwardRef<HTMLDivElement, Props>(
  function AnimatedView({ children, ...props }, ref) {
    return <div ref={ref} {...props}>{children}</div>;
  },
);

const AnimatedText = forwardRef<HTMLSpanElement, Props>(
  function AnimatedText({ children, ...props }, ref) {
    return <span ref={ref} {...props}>{children}</span>;
  },
);

const Animated = { View: AnimatedView, Text: AnimatedText, createAnimatedComponent };
export default Animated;
