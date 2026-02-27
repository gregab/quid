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
export function withRepeat(animation: unknown) { return animation; }
export function withDelay(_delay: number, animation: unknown) { return animation; }
export function withSequence(...animations: unknown[]) { return animations[animations.length - 1]; }
export function runOnJS<T extends (...args: unknown[]) => unknown>(fn: T): T { return fn; }
export function createAnimatedComponent<T>(component: T): T { return component; }

const identity = (x: number) => x;
export const Easing = {
  linear: identity,
  ease: identity,
  quad: identity,
  cubic: identity,
  sin: identity,
  circle: identity,
  exp: identity,
  elastic: () => identity,
  back: () => identity,
  bounce: identity,
  bezier: () => identity,
  inOut: (fn: (x: number) => number) => fn,
  in: (fn: (x: number) => number) => fn,
  out: (fn: (x: number) => number) => fn,
};

const AnimatedView = forwardRef<HTMLDivElement, Props>(
  function AnimatedView({ children, testID, className, entering: _entering, exiting: _exiting, style: _style, ...props }, ref) {
    return <div ref={ref} data-testid={testID as string} className={className as string} {...props}>{children}</div>;
  },
);

const AnimatedText = forwardRef<HTMLSpanElement, Props>(
  function AnimatedText({ children, testID, className, entering: _entering, exiting: _exiting, style: _style, ...props }, ref) {
    return <span ref={ref} data-testid={testID as string} className={className as string} {...props}>{children}</span>;
  },
);

/** Chainable entering/exiting animation stub. */
function makeEnteringAnimation() {
  const chain: Record<string, (...args: unknown[]) => typeof chain> = {};
  const handler = (..._args: unknown[]) => chain;
  chain.delay = handler;
  chain.duration = handler;
  chain.springify = handler;
  chain.damping = handler;
  chain.stiffness = handler;
  chain.withInitialValues = handler;
  return chain;
}

export const FadeInDown = makeEnteringAnimation();
export const FadeInUp = makeEnteringAnimation();
export const FadeIn = makeEnteringAnimation();
export const FadeOut = makeEnteringAnimation();
export const FadeOutUp = makeEnteringAnimation();
export const SlideInDown = makeEnteringAnimation();
export const SlideInUp = makeEnteringAnimation();

const Animated = { View: AnimatedView, Text: AnimatedText, createAnimatedComponent };
export default Animated;
