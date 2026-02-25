/**
 * Mock for react-native-safe-area-context.
 * SafeAreaView renders as a plain div; insets are all zero.
 */
import React from "react";

type Props = Record<string, unknown> & { children?: React.ReactNode };

export const SafeAreaView = ({ children, ...props }: Props) =>
  React.createElement("div", { "data-testid": "safe-area-view", ...props }, children);

export const SafeAreaProvider = ({ children }: Props) => children;

export const useSafeAreaInsets = () => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
});

export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};
